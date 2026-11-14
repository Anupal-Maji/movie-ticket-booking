# Movie Ticket Booking Platform

A full-stack movie ticket booking application built during the ElevanceSkills internship.

**Stack:** Node.js, Express, MySQL, Redis, vanilla HTML/CSS/JavaScript, Razorpay (test mode), Nodemailer.

## Features (one per internship task)

| Task | Feature |
|---|---|
| 1 | Server-side genre and language filtering with multi-select, pagination, sorting, dynamic filter counts and indexes |
| 2 | Booking confirmation emails from an HTML template, with retries and an error log |
| 3 | Secure YouTube trailer embedding with URL validation, lazy loading and a fallback |
| 4 | Razorpay payments with server-side signature checks, idempotency keys and a webhook |
| 5 | Seat locking for 2 minutes with database row locks and an automatic cleanup job |
| 6 | Admin analytics dashboard with role-based login, database aggregation, Redis caching and logout blacklist |

## Run it locally

1. Install Node.js, MySQL and Redis (on Windows, Memurai works as Redis).
2. Create the database and tables: `mysql -u root -p -e "CREATE DATABASE moviedb;"` then `mysql -u root -p moviedb < schema.sql`
3. Copy `.env.example` to `.env` and fill in your own values.
4. Run `npm install`
5. Run `node server.js`
6. Open `http://localhost:3000`

## Pages

| Page | Address |
|---|---|
| Movie list with filters | `/` |
| Movie detail and seat selection | `/movie-detail.html?id=1` |
| Admin dashboard | `/admin-dashboard.html` |

## Demo admin login (evaluation only)

The admin password is stored as a bcrypt hash. To create the demo admin in your own database, run:
`node setAdminPassword.js admin_demo Demo@1234`

Demo credentials: username `admin_demo`, password `Demo@1234` (demo only, used nowhere else).

## Notes

- Payments use Razorpay **test mode** keys only.
- Secrets live in `.env`, which is never uploaded.
- Performance tests used generated data in a separate test database (`seedBookings.js` and `seedMovies.js`).
