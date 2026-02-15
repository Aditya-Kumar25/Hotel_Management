import {z} from "zod";

export const signUp  = z.object({
    name : z.string().min(1,"Name is required"),
    email : z.string(),
    password : z.string().min(6,"Password must at least be 8 characters"),
    phone : z.string().optional(),
    role : z.enum(["customer","owner"]).optional().default("customer")
})

export const logIn = z.object({
    email : z.string().email(),
    password: z.string().min(1,'password is required'),
})

export const hotelSchema = z.object({
    name:z.string().min(1,"Name is required"),
    city:z.string(),
    country:z.string(),
    description: z.string().optional(),
    rating : z.number().multipleOf(0.1).default(0.0),
    amenities : z.array(z.string()).optional(),
    totalReviews : z.number().optional()    
})

export const roomSchema = z.object({
    roomNumber:z.string(),
    roomType:z.string(),
    pricePerNight:z.number().multipleOf(0.1),
    maxOccupancy:z.number()
})

export const bookingSchema = z.object({
    roomId : z.string(),
    checkInDate : z.coerce.date(),
    checkOutDate : z.coerce.date(),
    guests : z.number()
})