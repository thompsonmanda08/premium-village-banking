import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { BrandMark } from '@/app/BrandMark';
import { Card, CardHeader, PageHeader } from '@/ui';

export const LAST_UPDATED = '9 October 2026';

const link = 'font-semibold text-accent underline underline-offset-4';
const RulesLink = () => <Link to="/rules" className={link}>Rules page</Link>;

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-line py-4 first:border-t-0 first:pt-0 last:pb-0">
      <h3 className="mb-1 text-base font-semibold text-fg">{title}</h3>
      <div className="grid gap-2 text-base leading-relaxed text-fg [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-1 [&_ul]:pl-5">{children}</div>
    </div>
  );
}

/**
 * Public: people read it from the invite and sign-in screens before they have an account.
 * Figures (savings, rates, penalties) change per cycle, so they live on the Rules page and are never repeated here.
 */
export function TermsPage() {
  const { hash } = useLocation();
  // Router navigation does not scroll to a #fragment; do it once the sections exist.
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  }, [hash]);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BrandMark size={36} />
          <p className="text-sm font-semibold text-muted">Premium Village Bank</p>
        </div>
        <Link to="/" className="inline-flex min-h-12 items-center gap-1.5 rounded-xl px-3 text-base font-semibold text-accent transition duration-150 hover:bg-surface-2 active:scale-[.97]">
          <ArrowLeft aria-hidden className="size-5" />
          Back
        </Link>
      </div>

      <PageHeader title="Terms and privacy" subtitle={`Last updated ${LAST_UPDATED}`} />
      <nav aria-label="On this page" className="mb-5 flex flex-wrap gap-2">
        <a href="#terms" className="inline-flex min-h-12 items-center rounded-full border border-line bg-surface px-4 text-base font-medium text-fg">Terms of use</a>
        <a href="#privacy" className="inline-flex min-h-12 items-center rounded-full border border-line bg-surface px-4 text-base font-medium text-fg">Privacy policy</a>
      </nav>

      <div className="grid gap-4">
        <section id="terms" className="scroll-mt-4">
          <Card>
            <CardHeader title="Terms of use" />
            <Part title="Accepting these terms">
              <p>
                This app keeps the records of Premium Village Banking, a savings group run by its members. You accept these terms when you accept an
                invitation to join the group or create an account in the app. If you do not agree, do not accept the invitation, and tell your treasurer.
              </p>
            </Part>
            <Part title="What the app is">
              <ul>
                <li>A record of the group’s savings, declarations, loans, repayments, penalties and payouts.</li>
                <li>It is not a bank and does not hold or move money. Money is paid and received outside the app, as the group agrees.</li>
                <li>The group’s constitution is the final word. The app applies its rules; where the two disagree, the constitution wins and the record is corrected.</li>
              </ul>
            </Part>
            <Part title="The group’s rules">
              <p>
                Each cycle has its own figures: the minimum monthly saving, the declaration window, the late penalty per day, loan interest, excess interest,
                the membership fee, how much you can borrow in each month and how long you have to repay. The current figures are always on the <RulesLink />.
              </p>
              <p>Rules are set before a cycle starts and cannot be changed once it is running.</p>
            </Part>
            <Part title="Joining and your account">
              <ul>
                <li>Membership is by invitation from the treasurer. One account per member.</li>
                <li>Use the email address your invitation was sent to. Keep your password and sign-in links to yourself.</li>
                <li>On a shared phone, sign out when you finish. Signing out removes your data from the phone.</li>
              </ul>
            </Part>
            <Part title="Treasurer and admins">
              <ul>
                <li>Admins add members, send invitations, set the rules for a new cycle and confirm records.</li>
                <li>Changes admins make to members, invitations, roles and rules are recorded with who made them and when.</li>
                <li>The group always keeps at least one admin.</li>
              </ul>
            </Part>
            <Part title="Mistakes in your record">
              <p>Check your record regularly. If something looks wrong, tell your treasurer, who will correct it.</p>
            </Part>
            <Part title="Leaving the group">
              <p>
                Tell your treasurer. An admin marks you as having left, and you can no longer see the group’s information. Your records stay with the group,
                because they are part of its accounts and are needed to settle what you are owed or owe.
              </p>
            </Part>
            <Part title="Availability">
              <p>
                The app is run by volunteers on a best-effort basis. It may sometimes be slow or unavailable. It keeps a recent copy on your phone so you can
                look things up offline, but anything you do is only recorded once you are back online.
              </p>
            </Part>
            <Part title="Changes to these terms">
              <p>
                If these terms change, the date at the top changes and members are told in the app or by email. Continuing to use the app after that means you
                accept the new terms.
              </p>
            </Part>
            <Part title="Law">
              <p>These terms are governed by the laws of Zambia.</p>
            </Part>
          </Card>
        </section>

        <section id="privacy" className="scroll-mt-4">
          <Card>
            <CardHeader title="Privacy policy" subtitle="What happens to your information" />
            <Part title="Who is responsible">
              <p>
                Premium Village Banking, the group itself, decides how your information is used. Your treasurer is the contact for any question or request
                about your data. We follow the Data Protection Act No. 3 of 2021 of Zambia.
              </p>
            </Part>
            <Part title="What we keep">
              <ul>
                <li><strong>Who you are:</strong> your full name, the short name the group knows you by, your email address and, if you give it, your phone number.</li>
                <li><strong>Your account:</strong> your sign-in email, a scrambled (hashed) password if you set one, when you signed in, and the internet (IP) address used, which the sign-in service logs for security. If you sign in with Google, we receive the name, email address and profile picture link on your Google account.</li>
                <li><strong>Your money record:</strong> savings, declarations, loans, repayments, penalties, interest and payouts.</li>
                <li><strong>A change log:</strong> changes made by admins, who made them and when, including the details before and after.</li>
              </ul>
              <p>We do not use advertising, tracking or analytics, and we never sell or share your information for marketing.</p>
            </Part>
            <Part title="Why we keep it">
              <p>To run the group as its constitution sets out: keep accurate accounts, work out loans, interest and penalties, pay out at the end of a cycle, and resolve disagreements fairly.</p>
            </Part>
            <Part title="Who can see what">
              <ul>
                <li><strong>Every member</strong> sees the group list: names, who is an admin, and who is active. Members never see each other’s email or phone number.</li>
                <li>
                  <strong>Money figures:</strong> the group chooses. When figures are open, members can see each other’s figures. When they are private, you see only
                  your own and the group totals. The Group page shows the current setting.
                </li>
                <li><strong>Admins</strong> see everything, including contact details and the change log, because they run the accounts.</li>
                <li>These limits are enforced by the database itself, not only by the screens you see.</li>
              </ul>
            </Part>
            <Part title="Where it is stored">
              <ul>
                <li>The group’s database and sign-in service are run by Supabase, on servers in Ireland (European Union).</li>
                <li>The app itself is delivered by Vercel. Emails (invitations and sign-in links) go through an email delivery service.</li>
                <li>Encrypted backups are made every night and kept for 90 days on GitHub, in the United States. The key to open them is kept offline.</li>
                <li>Your information leaves Zambia for these services. Each one is a well-established provider with its own security and privacy commitments.</li>
              </ul>
            </Part>
            <Part title="On your phone">
              <p>
                The app keeps you signed in and keeps a copy of the group’s information on your device for up to 7 days, so it works offline. Signing out
                deletes both from the device. It also remembers your light or dark theme choice.
              </p>
            </Part>
            <Part title="How long we keep it">
              <p>
                Money records and the change log are kept for as long as the group exists, because they are its accounts. If you leave, your contact details
                can be removed on request; your money record stays so the accounts still add up.
              </p>
            </Part>
            <Part title="How it is protected">
              <ul>
                <li>Every connection is encrypted.</li>
                <li>Passwords are at least 12 characters with letters and numbers, and are stored only in scrambled form.</li>
                <li>Invitation links work once, expire after 14 days, and only for the email they were sent to.</li>
              </ul>
            </Part>
            <Part title="Your rights">
              <p>Under the Data Protection Act No. 3 of 2021 you can ask to:</p>
              <ul>
                <li>see the information we hold about you;</li>
                <li>correct anything that is wrong;</li>
                <li>delete information we no longer need (money records the group must keep for its accounts stay);</li>
                <li>object to how your information is used.</li>
              </ul>
              <p>
                Ask your treasurer. We will reply within 30 days. If you are not satisfied, you can complain to the Office of the Data Protection Commissioner
                of Zambia.
              </p>
            </Part>
            <Part title="Changes to this policy">
              <p>If this policy changes, the date at the top changes and members are told in the app or by email.</p>
            </Part>
          </Card>
        </section>
      </div>
    </main>
  );
}
