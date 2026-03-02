/*
  Warnings:

  - You are about to drop the `bookings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `hotels` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `reviews` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `rooms` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_hotel_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_room_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_user_id_fkey";

-- DropForeignKey
ALTER TABLE "hotels" DROP CONSTRAINT "hotels_owner_id_fkey";

-- DropForeignKey
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_booking_id_fkey";

-- DropForeignKey
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_hotel_id_fkey";

-- DropForeignKey
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_user_id_fkey";

-- DropForeignKey
ALTER TABLE "rooms" DROP CONSTRAINT "rooms_hotel_id_fkey";

-- DropTable
DROP TABLE "bookings";

-- DropTable
DROP TABLE "hotels";

-- DropTable
DROP TABLE "reviews";

-- DropTable
DROP TABLE "rooms";

-- DropTable
DROP TABLE "users";

-- CreateTable
CREATE TABLE "User" (
    "id" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL,
    "phone" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
