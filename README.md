# HawkerPoint

A Singapore hawker centre food ordering platform built for the Back-End Development (BED) assignment. Customers can browse hawker centres and stalls, view menus, place and pay for orders, and leave reviews and complaints. Stall holders get a full dashboard to manage their menu, orders, reviews, analytics, hygiene records, payments, and account. Operators manage their owned hawker centres, stalls, and rental agreements, with monthly billing and revenue tracked per centre.

**Course:** Back-End Development (BED) · Ngee Ann Polytechnic
**Repository:** https://github.com/Shawnnho/BEDASG

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Web framework | Express 4 |
| Database | Microsoft SQL Server (Express) via `mssql` |
| Authentication | JWT in HTTP-only cookies (`jsonwebtoken` + `cookie-parser`) |
| Password hashing | `bcrypt` |
| Validation | `joi` |
| Config | `dotenv` |
| Dev tooling | `nodemon` |

The application follows an **MVC architecture** — models handle database access, controllers hold the business logic, and routes map HTTP endpoints to controllers. The front end is served as static files from `public/` and communicates with the back end through a JSON REST API.

---

## Team Members

| Member | Responsibility |
|---|---|
| Shawn Ho | Stall-holder side — Dashboard, Orders, Menu, Reviews, Analytics, Hygiene, Account, Manage Payment |
| Wynn Lee | Customer — Homepage, Stall Browsing, View Stall Details, View Stall Menu Items, Choose Stall Addons, Adding Items to Cart, Customer Settings|
| Matthew Tan| Order History, View/Delete/Reorder orders, Promotion Page, View/Claim Promotions, Checkout Cart, Edit quantity, Apply Promotion |
| Matthew Tay Jun Kai | Feedback, Complaints & Operator side — Submit/Edit/Delete Reviews and Complaints, Personal Feedback History, General Feedback Page, Operator Dashboard (Centres, Stalls, Rental Agreements, Monthly Billing, Revenue) |
| Jovan Soo | Login, Signup and NEA officer side — Token Creation, Cookie, Authentication, Hygenie Grade, Hygiene Inspections and Manage Complaints |

---

## Project Structure

```
BEDASG/
├── app.js                  # Entry point — mounts middleware and routes
├── dbConfig.js             # SQL Server connection config
├── package.json
├── .env                    # Environment variables (not committed)
├── .gitignore
│
├── controllers/
│   ├── addonController.js
│   ├── authController.js
│   ├── cartController.js
│   ├── centreController.js
│   ├── checkoutCardController.js
│   ├── complaintController.js
│   ├── contactController.js
│   ├── customerOrdersController.js
│   ├── faqController.js
│   ├── favItemController.js
│   ├── favStallController.js
│   ├── feedbackcommentController.js
│   ├── feedbackreportController.js
│   ├── hygieneController.js
│   ├── menuController.js
│   ├── neaController.js
│   ├── operatorController.js
│   ├── orderController.js
│   ├── paymentController.js
│   ├── promotionController.js
│   ├── rentalController.js
│   ├── stallAccountController.js
│   ├── stallAnalyticsController.js
│   ├── stallController.js
│   ├── stallMenuController.js
│   └── stallReviewController.js
│
├── models/
│   ├── addonModel.js
│   ├── cartModel.js
│   ├── centreModel.js
│   ├── checkoutCardModel.js
│   ├── complaintModel.js
│   ├── contactModel.js
│   ├── customerOrdersModel.js
│   ├── faqModel.js
│   ├── favItemModel.js
│   ├── favStallModel.js
│   ├── feedbackcommentModel.js
│   ├── feedbackreportModel.js
│   ├── hygieneModel.js
│   ├── menuModel.js
│   ├── neaModel.js
│   ├── operatorbillModel.js
│   ├── operatorRevenueModel.js
│   ├── orderModel.js
│   ├── paymentModel.js
│   ├── promotionModel.js
│   ├── refreshTokenModel.js
│   ├── rentalAgreementModel.js
│   ├── stallAccountModel.js
│   ├── stallAnalyticsModel.js
│   ├── stallMenuModel.js
│   ├── stallModel.js
│   ├── stallReviewModel.js
│   └── userModel.js
│
├── routes/
│   ├── addonRoutes.js
│   ├── authRoutes.js
│   ├── cartRoutes.js
│   ├── centreRoutes.js
│   ├── checkoutCardRoutes.js
│   ├── commentRoutes.js
│   ├── complaintRoutes.js
│   ├── contactRoutes.js
│   ├── customerOrdersRoutes.js
│   ├── faqRoutes.js
│   ├── favItemRoutes.js
│   ├── favStallRoutes.js
│   ├── hygieneRoutes.js
│   ├── menuRoutes.js
│   ├── neaRoutes.js
│   ├── operatorRoutes.js
│   ├── orderRoutes.js
│   ├── paymentRoutes.js
│   ├── promotionRoutes.js
│   ├── rentalRoutes.js
│   ├── reportRoutes.js
│   ├── reviewRoutes.js
│   ├── stallAccountRoutes.js
│   ├── stallAnalyticsRoutes.js
│   ├── stallMenuRoutes.js
│   └── stallRoutes.js
│
├── middlewares/
│   ├── auth.js
│   ├── imageStorage.js
│   ├── rentPaywall.js
│   ├── validation.js
│   └── verifyToken.js
│
├── database/               # SQL creation script + sample data
│   └── dbscript.sql
└── public/                 # Static front end
    ├── HTML pages
    │   ├── index.html
    │   ├── home.html
    │   ├── about.html
    │   ├── how-it-works.html
    │   ├── pricing.html
    │   ├── credits.html
    │   ├── privacy.html
    │   ├── terms-of-service.html
    │   ├── help.html
    │   ├── contact.html
    │   ├── signin.html
    │   ├── signup.html
    │   ├── account.html
    │   ├── centres.html
    │   ├── stall.html
    │   ├── menu.html
    │   ├── item.html
    │   ├── cart.html
    │   ├── card.html
    │   ├── orders.html
    │   ├── qr.html
    │   ├── payment_recieved.html
    │   ├── promotions.html
    │   ├── review.html
    │   ├── complaint.html
    │   ├── report.html
    │   ├── feedback.html
    │   ├── feedback_history.html
    │   ├── general-feedback.html
    │   ├── nea.html
    │   ├── hygiene.html
    │   ├── hygiene-history.html
    │   ├── hygiene-trend.html
    │   ├── operator.html
    │   ├── rental-payment.html
    │   ├── stall-dashboard.html
    │   ├── stall-orders.html
    │   ├── stall-menu.html
    │   ├── stall-review.html
    │   ├── stall-analytics.html
    │   └── stall-account.html
    │
    ├── css/
    │   ├── styles.css
    │   ├── browsing.css
    │   ├── footer.css
    │   ├── menuItems.css
    │   ├── hygiene.css
    │   ├── nea.css
    │   ├── operator.css
    │   ├── stall-holder.css
    │   ├── feedback-redesign.css
    │   ├── general-feedback.css
    │   └── upload-feedback.css
    │
    ├── js/                  # One script per page
    │   ├── authClient.js
    │   ├── authNav.js
    │   ├── home.js
    │   ├── index.js
    │   ├── centres.js
    │   ├── stall.js
    │   ├── menu.js
    │   ├── item.js
    │   ├── cart.js
    │   ├── card.js
    │   ├── orders.js
    │   ├── qr.js
    │   ├── payment_recieved.js
    │   ├── promotions.js
    │   ├── account.js
    │   ├── signin.js
    │   ├── signup.js
    │   ├── contact.js
    │   ├── help.js
    │   ├── complaint.js
    │   ├── report.js
    │   ├── review.js
    │   ├── feedback.js
    │   ├── feedback_history.js
    │   ├── general-feedback.js
    │   ├── nea.js
    │   ├── hygiene.js
    │   ├── hygiene-history.js
    │   ├── hygiene-trend.js
    │   ├── operator.js
    │   ├── rent-guard.js
    │   ├── rental-payment.js
    │   ├── stall-dashboard.js
    │   ├── stall-orders.js
    │   ├── stall-menu.js
    │   ├── stall-review.js
    │   ├── stall-analytics.js
    │   ├── stall-account.js
    │   └── stall-badges.js
    │
    └── images/
        ├── menu/           # Menu item images (per-stall subfolders)
        ├── stalls/         # Stall hero images
        └── uploads/
```

---

## Features

**All Users**
- Secure login and signup with password confirmation
- Sessions via httpOnly cookies with automatic token refresh
- Guest browsing without an account
- Role-based redirect to correct dashboard after login

**Customer**
- Browse hawker centres and stalls
- View stall menus with images, prices, and categories
- Add items to cart, place orders, and pay
- Leave reviews and ratings
- Favourite stalls and items, view promotions
- Submit complaints, feedback, and contact requests

**Stall Holder**
- Dashboard with key stats
- Orders — view, update status, cancel with refund
- Menu — add, edit, delete items
- Reviews — read and respond
- Analytics — sales and performance
- Hygiene — NEA grade records
- Account and rental payment management

**NEA Officer**
- Schedule, complete, or cancel hygiene inspections
- Manage complaints — status tracking, escalate to inspection
- Manually override a stall's hygiene grade
- Grade distribution overview across all stalls

 **Hawker Operator**
- Dashboard overview — centre count, total stalls, active agreements, revenue
- View hawker centres, with revenue per centre
- View stalls by one centre or across all centres at once
- Create rental agreements — stall, owner, monthly rent, plus utilities, cleaning, penalty, and other charges, with a live running total
- Edit and delete rental agreements
- Manage monthly bills per stall
---

## Prerequisites

- **Node.js** (LTS recommended)
- **SQL Server** (Express is fine), with:
  - TCP/IP protocol enabled
  - SQL Server Browser running (for named instances)
  - Mixed Mode authentication enabled

---


## Setup & Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Shawnnho/BEDASG.git
   cd BEDASG
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create a `.env` file** in the project root:
   ```env
   DB_USER=your_sql_username
   DB_PASSWORD=your_sql_password
   DB_SERVER=localhost
   DB_INSTANCE=SQLEXPRESS
   DB_DATABASE=HawkerPointDB
   DB_PORT=1433
   DB_ENCRYPT=false
   DB_TRUST_SERVER_CERTIFICATE=true
   JWT_SECRET=your_jwt_secret
   PORT=3000
   ```
   > Adjust `DB_SERVER` to match your instance. Never commit `.env`.

4. **Set up the database**
   Run the SQL creation script (with sample data) from the `database/` folder against your SQL Server instance using SSMS or `sqlcmd`.

5. **Run the app**
   ```bash
   npm run devStart
   ```
   Then visit http://localhost:3000

---

## Available Scripts

| Script | Command | Description |
|---|---|---|
| `devStart` | `nodemon app.js` | Run in development with auto-restart |

To run without nodemon: `node app.js`

---

## Authentication

- On login, the server issues a **JWT** stored in an **HTTP-only cookie**.
- The `verifyToken` middleware validates the token on protected routes and attaches the user to the request.
- Passwords are hashed with **bcrypt** before storage.

---

## License

ISC — for educational use as part of the BED assignment.
