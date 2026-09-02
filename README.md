# ReedShelf Web App & Backend

A full-stack reading and library management web application with **Supabase Storage** for PDF book storage, SQLite database for metadata and user accounts, JWT authentication, and a responsive React frontend.

---

## 🌟 Key Features

- **Supabase Object Storage**: Uploaded PDF books are stored securely in Supabase Storage with fast streaming and HTTP Range request support (`206 Partial Content`) for instant page seeking in pdf.js.
- **Secure Authentication**: JWT-based auth with bcrypt password hashing, sign-up, sign-in, password reset, and profile avatar management.
- **Personal Library**: Cover grid, standing shelf, compact list, and wide-cover layouts with original book-cover extraction.
- **PDF Reader**: Built-in razor-sharp PDF viewer with themes (Dark, Sepia, Light), zoom, fit modes, text selection, and 1-tap highlighting.
- **Reading Plans**: Custom target schedules (Sprint, 2 Weeks, 1 Month, 2 Months) calculating daily page goals, reading time, and milestone checkpoints.
- **Highlights & Progress**: Reading progress auto-save and persistent highlight passages synced to the database.
- **Accessibility & Settings**: Dark mode toggle, adjustable font sizes, line heights, keyboard navigation, and sign-out confirmation.

---

## 🚀 Getting Started

### 1. Install Dependencies

Install frontend and backend packages:

```bash
npm install
```

*(Or if running the backend independently, run `npm install` inside the `server/` directory)*

---

### 2. Configure Supabase Storage & Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Open `.env` and fill in your Supabase credentials:

```env
PORT=5000
JWT_SECRET=your_secure_jwt_secret_key_here

# Supabase Storage Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your_supabase_api_key_here
SUPABASE_BUCKET_NAME=reedshelf-books
```

#### 🔑 How to get your Supabase Credentials:

1. **Create a Free Account & Project**:
   - Go to [Supabase](https://supabase.com/) and create a free project (no credit card required!).

2. **Copy Project URL & API Key**:
   - In your project dashboard, click on **Project Settings** (gear icon) -> **API**.
   - Copy the **Project URL** -> paste as `SUPABASE_URL`.
   - Under **Project API keys**, copy the `service_role` key (or `anon` public key) -> paste as `SUPABASE_KEY`.

3. **Storage Bucket**:
   - The bucket `reedshelf-books` will be **automatically created** by the backend on first run! You do not need to configure anything manually in the Supabase Storage tab.

> **Note**: If Supabase keys are not yet provided, the backend will automatically fall back to local disk storage (`server/uploads/`) so you can develop and test immediately without errors.

---

### 3. Run the Backend and Frontend

Run the backend server:

```bash
npm run server
# or with auto-reload:
npm run server:dev
```

In a separate terminal, run the Vite frontend development server:

```bash
npm run dev
```

The app will be accessible at `http://localhost:5173`, and frontend API requests (`/api/*`) are automatically proxied to the backend at `http://localhost:5000`.

---

## 📡 Backend API Endpoints

### 🔐 Authentication (`/api/auth`)
- `POST /api/auth/register` - Create account (`{ name, email, password }`)
- `POST /api/auth/login` - Sign in (`{ email, password }`)
- `GET /api/auth/me` - Get current authenticated user profile & library stats
- `PUT /api/auth/profile` - Update display name and avatar photo
- `PUT /api/auth/password` - Change password
- `POST /api/auth/reset-password` - Reset password

### 📚 Books & Supabase Storage (`/api/books`)
- `GET /api/books` - List all books for the authenticated user
- `GET /api/books/:id` - Get metadata for a specific book
- `POST /api/books/upload` - Upload PDF book to Supabase Storage (multipart form: `file`, `title`, `author`, `totalPages`, `coverDataUrl`)
- `GET /api/books/:id/file` - Stream PDF file directly from Supabase Storage with HTTP Range request support (`206 Partial Content`)
- `PUT /api/books/:id` - Update book metadata
- `DELETE /api/books/:id` - Delete book from database, Supabase Storage, highlights, and reading progress

### 📈 Reading Progress (`/api/progress`)
- `GET /api/progress/:bookId` - Get current page for a book
- `PUT /api/progress/:bookId` - Save current page (`{ page }`)

### 🎯 Reading Plans (`/api/plans`)
- `GET /api/plans` - List user's active reading plans
- `POST /api/plans` - Create reading plan (`{ bookId, startDate, targetDate, days, pagesPerDay, totalPages }`)
- `DELETE /api/plans/:id` - Delete reading plan

### ✨ Highlights (`/api/highlights`)
- `GET /api/highlights/:bookId` - Get saved highlights for a book
- `POST /api/highlights/:bookId` - Save highlight (`{ page, text, color }`)
- `DELETE /api/highlights/:id` - Delete highlight

### ⚙️ User Settings (`/api/settings`)
- `GET /api/settings` - Get reader and UI preferences
- `PUT /api/settings` - Update preferences (`darkMode`, `libraryView`, `fontSize`, `lineHeight`, etc.)

### 🩺 System & Storage Health (`/api/health`)
- `GET /api/health` - Check backend status, database connection, and Supabase Storage bucket connectivity

---

## 🏗️ Architecture

```
reedshelfwebapp/
├── server/
│   ├── src/
│   │   ├── config.js          # Environment & Supabase credentials
│   │   ├── db.js              # SQLite database & auto-schema migration
│   │   ├── index.js           # Express app & route registration
│   │   ├── middleware/
│   │   │   └── auth.js        # JWT token verification
│   │   ├── routes/
│   │   │   ├── auth.js        # Register, login, profile, password
│   │   │   ├── books.js       # Book CRUD & Supabase streaming
│   │   │   ├── health.js      # System & Supabase connectivity test
│   │   │   ├── highlights.js  # Highlights CRUD
│   │   │   ├── plans.js       # Reading plans CRUD
│   │   │   ├── progress.js    # Reading progress auto-save
│   │   │   └── settings.js    # User preferences
│   │   └── storage/
│   │       └── supabase.js    # Supabase Storage integration
│   ├── package.json
│   └── .env.example
├── src/
│   ├── lib/
│   │   ├── api.js             # Frontend API client
│   │   ├── appStore.js        # Centralized app store & caching
│   │   └── pdfMetadata.js     # Browser-side PDF title/author extraction
│   ├── pages/                 # Dashboard, Library, Upload, Reader, etc.
│   └── components/            # AppShell, BookCard, ThemeToggle, etc.
├── vite.config.js             # Vite config with /api proxy
├── package.json
└── README.md
```
