# hmpps-digital-canteen-medusa-service
E-commerce service for the HMPPS Digital Canteen.

## Running application locally

Run

    docker compose up -d

Add .env to ./backend

    JWT_SECRET=supersecret
    COOKIE_SECRET=supersecret
    ADMIN_CORS=http://localhost:9000
    STORE_CORS=http://localhost:8000
    AUTH_CORS=http://localhost:9000
    DATABASE_URL=postgres://test-user:test-password@localhost:5432/medusaDB
    REDIS_URL=redis://localhost:6379
    MEDUSA_BACKEND_URL=http://localhost:9000
    DISABLE_MEDUSA_ADMIN=false

Run from ./backend

    npm install --legacy-peer-deps
    npm run build
    npx medusa db:migrate 

Create admin user, only needs done once (unless image destroyed/removed)
    

    npx medusa user --email admin@admin.com --password supersecret 

To start

    npm run dev

Admin portal

    http://localhost:9000/app/

### OPA specification
To update OPA spec
npx medusa-oas oas --type store --out-dir ./src/oas --paths ./src/api --base ./src/oas/store.base.yaml