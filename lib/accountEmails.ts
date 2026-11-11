/** Transactional account emails. No profile names, tracking pixels or marketing lists. */
export type AccountEmailKind = "welcome" | "membership";

const SITE = "https://www.tatestv.ca";

export function accountEmail(kind: AccountEmailKind) {
  const member = kind === "membership";
  const subject = member
    ? "You're in! Your Tate's TV membership is active 📺"
    : "Welcome to Tate's TV — your next channel awaits 📺";
  const preview = member
    ? "Premium themes, more profiles, and your next favourite channel. Let's get watching."
    : "Your free account is ready. Pick a profile, find a channel, and make yourself at home.";
  const title = member ? "You're part of the picture." : "Make yourself at home.";
  const introduction = member
    ? "Your membership is active! Thanks for supporting Tate's TV and helping this little corner of television grow. Your membership extras are ready when you are."
    : "The TV is on, the remote is yours, and there's a spot on the couch waiting for you. Your email is confirmed and your free Tate's TV account is ready.";
  const features = member
    ? [
      ["01", "Set the scene", "Explore the premium theme collection, included while your membership is active."],
      ["02", "Make room for everyone", "Create up to 10 profiles, each with its own favourites, watchlist and theme choices."],
      ["03", "Tell us what you miss", "Use Request a Show in your account to send a suggestion. Every request is reviewed; availability isn't guaranteed."],
    ]
    : [
      ["01", "Find your channel", "Jump into free live TV, browse the guide, or explore the library."],
      ["02", "Make it yours", "Create your profiles, save favourites, build a watchlist and choose a free theme."],
      ["03", "Set up the family", "Create a Kids profile with a parent PIN and access to the channels and titles approved for Kids."],
    ];
  const accountNote = member
    ? "Your membership renews automatically according to the plan you selected. View your plan, invoices and cancellation options in Account → Manage membership. Free viewing stays free."
    : "Your account and free viewing are free. Membership and premium theme purchases are optional.";
  const rows = features.map(([number, heading, body]) => `<tr><td width="44" valign="top" style="padding:18px 0;color:#7cebd8;font-size:14px;font-weight:bold;">${number}</td><td style="padding:16px 0;border-bottom:1px solid #303142;"><h2 style="margin:0 0 6px;font-size:18px;line-height:25px;color:#fff7e8;">${heading}</h2><p style="margin:0;font-size:15px;line-height:24px;color:#c9cbd9;">${body}</p></td></tr>`).join("");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${member ? "Your membership is active" : "Welcome to Tate's TV"}</title></head>
<body style="margin:0;padding:0;background-color:#090b15;font-family:Arial,Helvetica,sans-serif;color:#fff7e8;">
<div style="display:none;font-size:1px;line-height:1px;color:#090b15;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preview}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#090b15"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:#171a29;border:1px solid #363546;border-radius:20px;overflow:hidden;">
<tr><td height="6" bgcolor="#79e5d4" style="font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td align="center" style="padding:28px 24px 22px;"><a href="${SITE}" style="text-decoration:none;"><img src="${SITE}/brand/ttv-neon-mini.png" width="96" height="96" alt="Tate's TV" border="0" style="display:block;width:96px;height:96px;border-radius:18px;color:#fff7e8;font-size:28px;font-weight:bold;"></a><p style="margin:14px 0 0;font-size:23px;line-height:28px;font-weight:bold;letter-spacing:1px;color:#fff7e8;">TATE'S TV</p></td></tr>
<tr><td style="padding:12px 28px 30px;">
<p style="margin:0 0 14px;font-size:12px;line-height:20px;font-weight:bold;letter-spacing:2px;color:#7cebd8;">${member ? "MEMBERSHIP ACTIVATED" : "WELCOME TO THE CHANNEL"}</p>
<h1 style="margin:0 0 18px;font-size:36px;line-height:42px;letter-spacing:-1px;color:#fff7e8;">${title}</h1>
<p style="margin:0 0 26px;font-size:17px;line-height:28px;color:#d7d8e2;">${introduction}</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#f1ca78" align="center" style="border-radius:9px;"><a href="${SITE}/tv" style="display:inline-block;padding:17px 28px;border:1px solid #f1ca78;border-radius:9px;color:#17151d;font-size:16px;font-weight:bold;text-decoration:none;">Start watching &nbsp;▶</a></td></tr></table>
<p style="margin:15px 0 10px;font-size:14px;line-height:22px;"><a href="${SITE}/account" style="color:#8deedd;text-decoration:underline;">${member ? "Explore your member benefits" : "Open your account"}</a></p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:16px;">${rows}</table>
<p style="margin:28px 0 0;font-size:16px;line-height:27px;color:#d7d8e2;">Thanks for being here. I'm building Tate's TV a little further every day, and I'm glad you're part of it.</p>
<p style="margin:14px 0 0;font-size:17px;line-height:26px;font-weight:bold;color:#f1ca78;">Tate<br><span style="font-size:13px;font-weight:normal;color:#b7bbd0;">Creator of Tate's TV</span></p>
</td></tr>
<tr><td bgcolor="#111421" style="padding:24px 28px;border-top:1px solid #303142;">
<p style="margin:0 0 14px;font-size:13px;line-height:21px;color:#afb5ca;">${accountNote}</p>
<p style="margin:0 0 14px;font-size:13px;line-height:21px;"><a href="${SITE}/account" style="color:#d8dbe7;">Your account</a> &nbsp;·&nbsp; <a href="${SITE}/help" style="color:#d8dbe7;">Help</a> &nbsp;·&nbsp; <a href="${SITE}/privacy" style="color:#d8dbe7;">Privacy</a></p>
<p style="margin:0;font-size:11px;line-height:18px;color:#969db4;">This is an account ${member ? "membership confirmation" : "welcome"} from Tate's TV. It doesn't subscribe you to marketing emails. If you didn't create this account, visit our Help page.</p>
</td></tr></table>
<p style="margin:20px 0 0;font-size:12px;letter-spacing:1px;color:#a7afc8;">GOOD TV. YOUR WAY.</p>
</td></tr></table></body></html>`;
  const text = `${title}\n\n${introduction}\n\nStart watching: ${SITE}/tv\nYour account: ${SITE}/account\n\n${features.map(([, heading, body]) => `${heading}\n${body}`).join("\n\n")}\n\nThanks for being here. I'm building Tate's TV a little further every day, and I'm glad you're part of it.\n\nTate\nCreator of Tate's TV\n\n${accountNote}\n\nHelp: ${SITE}/help\nPrivacy: ${SITE}/privacy\n\nThis account email doesn't subscribe you to marketing emails.`;
  return { subject, html, text };
}
