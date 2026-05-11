#!/bin/sh
# Prisma initialization script

echo "Generating Prisma Client..."
cd /app/packages/database
npx prisma generate || {
    echo "Prisma generate failed, retrying in 5 seconds..."
    sleep 5
    npx prisma generate || {
        echo "Prisma generate failed again. Continuing anyway..."
    }
}

echo "Running database migrations..."
npx prisma migrate deploy || {
    echo "Migration failed. Database might need manual setup."
}

echo "Prisma setup complete!"
