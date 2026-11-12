# Ajo

Run an ajo, esusu or susu savings group without the paper notebook. Everyone pays the same amount each round, and each round one member takes the whole pot. Ajo keeps the record for the organiser.

- **This round:** whose turn it is, when it's due, what's been collected, and who's paid in full, in part or not yet. Tap a member to record a payment, including part payments and payments made on an earlier date, or to send them a ready-written WhatsApp reminder.
- **Pot paid out:** marks the turn done and moves the group on to the next person.
- **Members:** what each person has paid in, whether they're behind, how many rounds they paid late, and when they collect. You can swap turns that haven't been paid out yet.
- **Schedule:** every round, its date and its status. Monthly groups keep the same day each month (31 Jan, 28 Feb, 31 Mar).
- **New group:** pounds or naira, weekly, fortnightly or monthly, and **Draw lots** for a fair payout order.
- **Share update:** posts a ✅/⏳ summary to the group chat.
- **Private:** groups are saved only on the device, with backups you can save and restore. No money moves through the app.

## Run it

```
npm install
npm run dev
npm test
```

## Put it online (GitHub Pages)

The files must sit at the top level of the repo, with `package.json` next to `.github`. In PowerShell, run one line at a time:

```
git init
git add -A
git commit -m "Ajo"
git branch -M main
git remote add origin https://github.com/Bhigayo/ajo.git
git push -u origin main
```

Create the empty `ajo` repo on GitHub first. Then go to **Settings → Pages → Source: GitHub Actions**. The site will be at `https://bhigayo.github.io/ajo/`.
