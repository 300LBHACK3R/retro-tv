import type { MembershipNoticeKind, MembershipNoticeContext } from "./membershipNotices";

/** Transactional account emails. No profile names, tracking pixels or marketing lists. */
export type AccountEmailKind = "welcome" | "membership" | MembershipNoticeKind;

const SITE = "https://www.tatestv.ca";

export function accountEmail(kind: AccountEmailKind, context?: MembershipNoticeContext) {
  const date = context?.periodEnd && Number.isFinite(context.periodEnd)
    ? new Date(context.periodEnd * 1000).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) + " (UTC)" : "the end of your current billing period";
  const notices = {
    renewal_reminder: {
      subject: "A heads-up: your Tate's TV membership renews soon 📺", title: "More good TV ahead.",
      preview: "Your next membership renewal is coming up. Here is where to review it.",
      introduction: `A quick heads-up: your membership is scheduled to renew on ${date}. Thanks for keeping Tate's TV growing. You can review the upcoming amount, update your payment method or cancel future renewals in your account.`,
    },
    payment_failed: {
      subject: "Your Tate's TV membership needs a quick check", title: "Let's keep things rolling.",
      preview: "Your latest membership payment did not complete. Your free TV is still here.",
      introduction: "Your latest membership payment didn't complete. Open Manage membership in your account to review the invoice and payment method. You can keep watching free TV while you sort it out.",
    },
    membership_ending: {
      subject: "Your Tate's TV cancellation is confirmed", title: "You're always welcome here.",
      preview: "Automatic renewal is off. Here is what happens next.",
      introduction: `Your membership is set to end on ${date}, and automatic renewal is turned off. Your current paid membership benefits stay available through that date. Free viewing and your account are still here whenever you want them.`,
    },
    membership_ended: {
      subject: "Your Tate's TV membership has ended", title: "The TV is still on.",
      preview: "Your membership subscription has ended. Free viewing remains available.",
      introduction: "Your membership subscription has ended. Thank you for supporting Tate's TV. You can still watch free TV, use your account and enjoy any themes you bought separately.",
    },
  };
  const notice = kind === "welcome" || kind === "membership" ? null : notices[kind];
  const member = kind === "membership";
  const subject = notice?.subject ?? (member
    ? "You're in! Your Tate's TV membership is active 📺"
    : "Welcome to Tate's TV — your next channel awaits 📺");
  const preview = notice?.preview ?? (member
    ? "Premium themes, more profiles, and your next favourite channel. Let's get watching."
    : "Your free account is ready. Pick a profile, find a channel, and make yourself at home.");
  const title = notice?.title ?? (member ? "You're part of the picture." : "You're in. Grab the remote.");
  const introduction = notice?.introduction ?? (member
    ? "Your membership is active! Thanks for supporting Tate's TV and helping this little corner of television grow. Your membership extras are ready when you are."
    : "The TV is on, the remote is yours, and there's a spot on the couch waiting for you. Your email is confirmed and your free Tate's TV account is ready. Welcome aboard!");
  const features = notice ? [] : member
    ? [
      ["01", "Set the scene", "Explore the premium theme collection, included while your membership is active."],
      ["02", "Make room for everyone", "Create up to 10 profiles, each with its own favourites, watchlist and theme choices."],
      ["03", "Tell us what you miss", "Use Request a Show in your account to send a suggestion. Every request is reviewed; availability isn't guaranteed."],
    ]
    : [
      ["01", "Find your channel", "Jump into free live TV, browse the guide, or explore the library."],
      ["02", "Make it yours", "Build favourites and a watchlist on the website, choose a free theme, and sign in on Roku with the same account."],
      ["03", "Set up the family", "Create a Kids profile with a parent PIN and access to the channels and titles approved for Kids."],
    ];
  const actionUrl = notice ? `${SITE}/account` : `${SITE}/tv`;
  const actionText = notice ? "Manage membership" : "Start watching";
  const eyebrow = notice ? "YOUR MEMBERSHIP UPDATE" : member ? "MEMBERSHIP ACTIVATED" : "WELCOME TO THE CHANNEL";
  const accountNote = notice ? "Manage your subscription in Account → Manage membership. Free viewing stays free. This is a service notice, not a marketing email."
    : member
    ? "Your membership renews automatically according to the plan you selected. View your plan, invoices and cancellation options in Account → Manage membership. Free viewing stays free."
    : "Your account and free viewing are free. Membership and premium theme purchases are optional.";
  const rows = features.map(([number, heading, body]) => `<tr><td width="44" valign="top" style="width:44px;vertical-align:top;padding:18px 16px 18px 0;color:#7cebd8;font-size:14px;font-weight:bold;">${number}</td><td style="padding:16px 0;border-bottom:1px solid #303142;"><h2 style="margin:0 0 6px;font-size:18px;line-height:25px;color:#fff7e8;">${heading}</h2><p style="margin:0;font-size:15px;line-height:24px;color:#c9cbd9;">${body}</p></td></tr>`).join("");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background-color:#090b15;font-family:Arial,Helvetica,sans-serif;color:#fff7e8;">
<div style="display:none;font-size:1px;line-height:1px;color:#090b15;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preview}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#090b15"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:#171a29;border:1px solid #363546;border-radius:20px;overflow:hidden;">
<tr><td height="6" bgcolor="#79e5d4" style="background-color:#79e5d4;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td align="center" style="text-align:center;padding:28px 24px 22px;"><a href="${SITE}" style="text-decoration:none;"><img src="${SITE}/brand/ttv-neon-mini.png" width="96" height="96" alt="Tate's TV" border="0" style="display:block;margin:0 auto;width:96px;height:96px;border-radius:18px;color:#fff7e8;font-size:28px;font-weight:bold;"></a><p style="margin:14px 0 0;font-size:23px;line-height:28px;font-weight:bold;letter-spacing:1px;color:#fff7e8;">TATE'S TV</p></td></tr>
<tr><td style="padding:12px 28px 30px;">
<p style="margin:0 0 14px;font-size:12px;line-height:20px;font-weight:bold;letter-spacing:2px;color:#7cebd8;">${eyebrow}</p>
<h1 style="margin:0 0 18px;font-size:36px;line-height:42px;letter-spacing:-1px;color:#fff7e8;">${title}</h1>
<p style="margin:0 0 26px;font-size:17px;line-height:28px;color:#d7d8e2;">${introduction}</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#f1ca78" align="center" style="background-color:#f1ca78;border-radius:9px;"><a href="${actionUrl}" style="display:inline-block;background-color:#f1ca78;padding:17px 28px;border:1px solid #f1ca78;border-radius:9px;color:#17151d;font-size:16px;font-weight:bold;text-decoration:none;">${actionText} &nbsp;▶</a></td></tr></table>
<p style="margin:15px 0 10px;font-size:14px;line-height:22px;"><a href="${SITE}/account" style="color:#8deedd;text-decoration:underline;">${member ? "Explore your member benefits" : "Open your account"}</a></p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:16px;">${rows}</table>
<p style="margin:28px 0 0;font-size:16px;line-height:27px;color:#d7d8e2;">Thanks for being here. I'm building Tate's TV a little further every day, and I'm glad you're part of it.</p>
<p style="margin:14px 0 0;font-size:17px;line-height:26px;font-weight:bold;color:#f1ca78;">Tate<br><span style="font-size:13px;font-weight:normal;color:#b7bbd0;">Creator of Tate's TV</span></p>
</td></tr>
<tr><td bgcolor="#111421" style="background-color:#111421;padding:24px 28px;border-top:1px solid #303142;">
<p style="margin:0 0 14px;font-size:13px;line-height:21px;color:#afb5ca;">${accountNote}</p>
<p style="margin:0 0 14px;font-size:13px;line-height:21px;"><a href="${SITE}/account" style="color:#d8dbe7;">Your account</a> &nbsp;·&nbsp; <a href="${SITE}/help" style="color:#d8dbe7;">Help</a> &nbsp;·&nbsp; <a href="${SITE}/privacy" style="color:#d8dbe7;">Privacy</a></p>
<p style="margin:0;font-size:11px;line-height:18px;color:#969db4;">This is an account ${notice ? "service notice" : member ? "membership confirmation" : "welcome"} from Tate's TV. It doesn't subscribe you to marketing emails. If you didn't create this account, visit our Help page.</p>
</td></tr></table>
<p style="margin:20px 0 0;font-size:12px;letter-spacing:1px;color:#a7afc8;">GOOD TV. YOUR WAY.</p>
</td></tr></table></body></html>`;
  const text = `${title}\n\n${introduction}\n\n${actionText}: ${actionUrl}\nYour account: ${SITE}/account\n\n${features.map(([, heading, body]) => `${heading}\n${body}`).join("\n\n")}\n\nThanks for being here. I'm building Tate's TV a little further every day, and I'm glad you're part of it.\n\nTate\nCreator of Tate's TV\n\n${accountNote}\n\nHelp: ${SITE}/help\nPrivacy: ${SITE}/privacy\n\nThis account email doesn't subscribe you to marketing emails.`;
  return { subject, html, text };
}

/** Numeric codes are for the TV. Link variants are published as Supabase templates. */
export function accountSecurityEmail(purpose: "signup" | "recovery", code?: string) {
  if (code !== undefined && !/^\d{6,10}$/.test(code)) throw new Error("Invalid verification code");
  const signup = purpose === "signup";
  const subject = signup ? "One last step — welcome to Tate's TV 📺" : "Reset your Tate's TV password";
  const title = signup ? "Your seat is ready." : "Let's get you back in.";
  const intro = signup
    ? "Welcome to Tate's TV! A little nostalgia, a world of television, and a place to make your own. Confirm your email to finish creating your free household account."
    : "We received a request to reset your Tate's TV password. Choose a new password to get back into your account.";
  const url = `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=${signup ? "email" : "recovery"}`;
  const label = signup ? "Verify my email" : "Reset my password";
  const instruction = code ? (signup ? "Enter this code on your Roku to finish creating your account." : "Enter this code on your Roku to choose a new password.")
    : "This link opens a secure confirmation page on Tate's TV. Continue there to complete your request.";
  const safety = code ? "Use it within 10 minutes. Never share this code." : "If the link has expired, request a new one from your account page. Never share this link.";
  const action = code
    ? `<p style="margin:24px 0;padding:18px 12px;background:#252b39;border:1px solid #58625e;border-radius:10px;color:#f1ca78;text-align:center;font-family:monospace;font-size:26px;line-height:34px;letter-spacing:3px;">${code}</p>`
    : `<table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#f1ca78" style="background-color:#f1ca78;border-radius:9px;"><a href="${url.replace(/&/g, "&amp;")}" style="display:inline-block;background-color:#f1ca78;padding:17px 24px;border:1px solid #f1ca78;border-radius:9px;color:#17151d;font-size:16px;font-weight:bold;text-decoration:none;">${label} &rarr;</a></td></tr></table>`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background-color:#090b15;font-family:Arial,Helvetica,sans-serif;color:#fff7e8;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${signup ? "Confirm your email and make yourself at home." : "Finish your password reset securely."}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#090b15"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="580" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:580px;background-color:#171a29;border:1px solid #363546;border-radius:20px;overflow:hidden;">
<tr><td height="6" bgcolor="#79e5d4" style="background-color:#79e5d4;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:28px 24px;"><p style="margin:0 0 32px;color:#f1ca78;font-size:23px;font-weight:bold;letter-spacing:1px;">TATE'S TV</p>
<p style="margin:0 0 16px;color:#7cebd8;font-size:12px;line-height:20px;font-weight:bold;letter-spacing:2px;">${signup ? "WELCOME TO THE CHANNEL" : "YOUR ACCOUNT, SECURELY"}</p>
<h1 style="margin:0 0 20px;color:#fff7e8;font-size:34px;line-height:40px;letter-spacing:-1px;">${title}</h1>
<p style="margin:0 0 22px;color:#d7d8e2;font-size:17px;line-height:28px;">${intro}</p>
<p style="margin:0 0 22px;color:#d7d8e2;font-size:16px;line-height:26px;">${instruction}</p>${action}
<p style="margin:24px 0 0;color:#c0c6d7;font-size:13px;line-height:22px;">${safety}</p></td></tr>
<tr><td bgcolor="#111421" style="background-color:#111421;padding:24px;border-top:1px solid #303142;"><p style="margin:0 0 18px;color:#afb5ca;font-size:13px;line-height:22px;">${signup ? "Free account. Free viewing. Membership is optional." : "If you didn't request a reset, you can ignore this email. Your password has not changed."}</p>
<p style="margin:0;color:#afb5ca;font-size:12px;line-height:21px;">${signup ? "Didn't start signing up? You can safely ignore this email.<br>" : ""}<a href="${SITE}/help" style="color:#8deedd;">Help</a> &nbsp;·&nbsp; <a href="${SITE}/privacy" style="color:#8deedd;">Privacy</a></p></td></tr></table>
<p style="margin:20px 0 0;color:#a7afc8;font-size:12px;letter-spacing:1px;">YOUR TV. YOUR WAY.</p></td></tr></table></body></html>`;
  const text = `${title}\n\n${intro}\n\n${instruction}\n\n${code ?? `${label}: ${url}`}\n\n${safety}\n\nIf you didn't request this, you can safely ignore this email.\n\nHelp: ${SITE}/help\nPrivacy: ${SITE}/privacy\n\nTate's TV — Your TV. Your way.`;
  return { subject, html, text };
}
