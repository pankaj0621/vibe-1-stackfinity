# Admin access

Admin accounts are provisioned outside public registration. Public sign-up only accepts student and employee roles.

To create the first admin in the configured `lawazia_transit` database, run:

```sh
npm run admin:create
```

The command creates `admin@lawazia.campus` unless `ADMIN_EMAIL` is set. It generates a strong password and prints it once after a successful insert. Save that password securely; running the command again will not replace an existing account or password.

After signing in, admins can open **Admin Control Room** to review accounts and requests, create student, employee, rider, or admin accounts, and open the dispatch and trip history tools. Admin access is checked by the API as well as the page. Admins have the same dispatch, trip, location, stop-calibration, and full-history permissions as riders.

The notification bell shows a private per-account inbox. It receives booking, clash, dispatch, trip, and account updates. Read state is stored in MongoDB and the unread count refreshes while signed in.
