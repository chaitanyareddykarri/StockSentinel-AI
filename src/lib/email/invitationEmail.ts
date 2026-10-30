import { buildInvitationUrl } from '@/lib/auth/invitationTokens';
export { buildInvitationUrl };

export interface SendInvitationEmailResult {
  delivered: boolean;
  provider: 'resend' | 'none';
  inviteUrl: string;
  warning?: string;
  error?: string;
}

/**
 * Dispatches a Store Manager onboarding invitation email.
 * If no external email service provider (e.g. RESEND_API_KEY) is configured in the environment,
 * safely returns delivered: false with an explicit setup warning and the copyable inviteUrl so the user/developer
 * is never misled into believing an email was dispatched.
 */
export async function sendStoreManagerInvitationEmail(params: {
  recipientEmail: string;
  companyName: string;
  storeName?: string;
  inviteUrl?: string;
  rawToken?: string;
  requestOrigin?: string;
  expiresInDays?: number;
}): Promise<SendInvitationEmailResult> {
  const origin = (params.requestOrigin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const computedUrl = buildInvitationUrl(origin, params.rawToken, params.inviteUrl);
  const effectiveStoreName = params.storeName || 'Assigned Retail Store';
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    return {
      delivered: false,
      provider: 'none',
      inviteUrl: computedUrl,
      warning:
        'Email delivery provider is not configured (RESEND_API_KEY is not set). Copy the single-use invitation link directly to share with the Store Manager.',
    };
  }

  try {
    const fromAddress = process.env.EMAIL_FROM || 'StockSentinel AI <invitations@stocksentinel.ai>';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [params.recipientEmail],
        subject: `Invitation: Manage ${effectiveStoreName} on StockSentinel AI`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 20px; background-color: #ffffff; color: #1e293b;">
            <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
              <h1 style="color: #064e3b; font-size: 20px; font-weight: 800; margin: 0;">StockSentinel AI</h1>
              <p style="color: #64748b; font-size: 12px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 0.05em;">Retail Operations Platform</p>
            </div>
            
            <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0;">Store Manager Activation Invitation</h2>
            
            <p style="font-size: 14px; line-height: 1.6; color: #334155;">
              You have been invited by <strong>${escapeHtml(params.companyName)}</strong> to manage inventory intelligence and shelf-walk audits for:
            </p>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0;">
              <div style="font-size: 14px; font-weight: 700; color: #064e3b;">${escapeHtml(effectiveStoreName)}</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Role: Store Manager (Single-Store Scoped Workspace)</div>
            </div>

            <p style="margin: 28px 0;">
              <a href="${computedUrl}" style="background-color: #064e3b; color: #ffffff; padding: 12px 24px; border-radius: 10px; font-size: 13px; font-weight: 700; text-decoration: none; display: inline-block;">
                Accept Invitation &amp; Activate Workspace
              </a>
            </p>

            <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
              This invitation link is single-use and will expire in ${params.expiresInDays || 7} days. If you do not have an account yet, you will be prompted to create your secure password upon accepting.
            </p>

            <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8;">
              If you were not expecting this invitation, please contact your retail administrator or ignore this email.
            </div>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return {
        delivered: false,
        provider: 'resend',
        inviteUrl: computedUrl,
        warning: `Email delivery API error (${res.status}): ${errBody.message || 'Unable to deliver message'}. Share link manually below.`,
      };
    }

    return {
      delivered: true,
      provider: 'resend',
      inviteUrl: computedUrl,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      delivered: false,
      provider: 'resend',
      inviteUrl: computedUrl,
      warning: `Email service connection error (${message}). Share link manually below.`,
    };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
