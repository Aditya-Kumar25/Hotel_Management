import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { signUp, logIn, hotelSchema, roomSchema, bookingSchema } from "./auth/validation";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import { authMiddleware } from "./auth/middleware";
import express from "express";
import { BookingStatus } from "./generated/prisma/client";

import { success } from "zod";


dotenv.config();
console.log("1");
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

export const prisma = new PrismaClient({ adapter });

const app = express();

app.use(express.json());

app.post("/api/auth/signup", async (req, res) => {
  const payload = req.body;
  const parse = signUp.safeParse(payload);

  if (!parse.success) {
    return res.status(400).json({
      success: false,
      data: null,
      error: "INVALID_REQUEST",
    });
  }

  const ezmail = parse.data.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: ezmail } });
  if (existing) {
    return res.status(400).json({
      success: false,
      data: null,
      error: "EMAIL_ALREADY_EXISTS",
    });
  }

  try {
    const hash = await bcrypt.hash(payload.password, 10);

    const user = await prisma.user.create({
      data: {
        name: parse.data.name,
        email: ezmail,
        password: hash,
        role: parse.data.role,
        phone: parse.data.phone ?? null,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        ...(user.phone && { phone: user.phone }),
        role: user.role,
      },
      error: null,
    });
  } catch (error) {
    res.status(400).json({ msg: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const payload = req.body;
  const parse = logIn.safeParse(payload);

  if (!parse.success) {
    return res.status(400).json({
      success: false,
      data: null,
      error: "INVALID_REQUEST",
    });
  }

  const us = await prisma.user.findUnique({
    where: { email: parse.data.email.toLowerCase() },
  });
  if (!us) {
    return res.status(401).json({
      success: false,
      data: null,
      error: "INVALID_CREDENTIALS",
    });
  }

  const pwd = await bcrypt.compare(parse.data.password, us.password);
  if (!pwd) {
    return res.status(401).json({
      success: false,
      data: null,
      error: "INVALID_CREDENTIALS",
    });
  }

  try {
    const token = jwt.sign(
      {
        id: us.id,
        role: us.role,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "1d" },
    );
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: us.id,
          name: us.name,
          email: us.email,
          role: us.role,
        },
      },
      error: null,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ msg: "Server Error" });
  }
});

app.post("/api/hotels", authMiddleware, async (req, res) => {
  const user = (req as any).user;
  if (user.role != "owner") {
    return res.status(403).json({
      success: false,
      error: "FORBIDDEN",
    });
  }

  const parsed = hotelSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: "INVALID_REQUEST",
    });
  }

  try {
    const hotel = await prisma.hotel.create({
      data: {
        name: parsed.data.name,
        city: parsed.data.city,
        country: parsed.data.country,
        description: parsed.data.description ?? null,
        rating: 0.0,
        amenities: parsed.data.amenities ?? [],
        totalReviews: 0,

        owner: {
          connect: {
            id: user.id,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        id: hotel.id,
        ownerId: hotel.ownerId,
        name: hotel.name,
        city: hotel.city,
        country: hotel.country,
        rating: Number(hotel.rating),
        totalReviews: hotel.totalReviews,
        amenities: hotel.amenities,
      },
      error: null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: null,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

app.post("/api/hotels/:hotelId/rooms", authMiddleware, async (req, res) => {
  const user = (req as any).user;
  const hotelId = req.params.hotelId as string;
  const dataa = req.body;

  const parsed = roomSchema.safeParse(dataa);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: "INVALID_REQUEST",
    });
  }

  const hotelexists = await prisma.hotel.findUnique({
    where: {
      id: hotelId,
    },
  });

  if (!hotelexists) {
    return res.status(404).json({
      success: false,
      error: "HOTEL_NOT_FOUND",
    });
  }

  if (hotelexists.ownerId !== user.id) {
    return res.status(403).json({
      success: false,
      error: "FORBIDDEN",
    });
  }

  const { roomNumber } = parsed.data;

  const roomexists = await prisma.room.findUnique({
    where: {
      hotelId_roomNumber: {
        hotelId,
        roomNumber,
      },
    },
  });

  if (roomexists) {
    return res.status(400).json({
      success: false,
      error: "ROOM_ALREADY_EXISTS",
    });
  }

  const room = await prisma.room.create({
    data: {
      roomNumber: parsed.data.roomNumber,
      roomType: parsed.data.roomType,
      pricePerNight: parsed.data.pricePerNight,
      maxOccupancy: parsed.data.maxOccupancy,
      hotel: {
        connect: {
          id: hotelId,
        },
      },
    },
  });
  return res.status(201).json({
    success: true,
    data: {
      id: room.id,
      hotelId: room.hotelId,
      roomNumber: room.roomNumber,
      roomType: room.roomType,
      pricePerNight: Number(room.pricePerNight),
      maxOccupancy: room.maxOccupancy,
    },
    error: null,
  });
});

app.get("/api/hotels", authMiddleware, async (req, res) => {
  try {
    const city =
      typeof req.query.city === "string" ? req.query.city : undefined;

    const country =
      typeof req.query.country === "string" ? req.query.country : undefined;

    const minPrice =
      typeof req.query.minPrice === "string"
        ? Number(req.query.minPrice)
        : undefined;

    const maxPrice =
      typeof req.query.maxPrice === "string"
        ? Number(req.query.maxPrice)
        : undefined;

    const minRating =
      typeof req.query.minRating === "string"
        ? Number(req.query.minRating)
        : undefined;

    const AND: any[] = [];

    if (city) {
      AND.push({
        city: {
          equals: city,
          mode: "insensitive",
        },
      });
    }

    if (country) {
      AND.push({
        country: {
          equals: country,
          mode: "insensitive",
        },
      });
    }

    if (minRating) {
      AND.push({
        rating: {
          gte: minRating,
        },
      });
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      AND.push({
        rooms: {
          some: {
            pricePerNight: {
              ...(minPrice !== undefined && { gte: minPrice }),
              ...(maxPrice !== undefined && { lte: maxPrice }),
            },
          },
        },
      });
    }

    const hotels = await prisma.hotel.findMany({
      where: AND.length > 0 ? { AND } : {},
      include: {
        rooms: {
          where: {
            pricePerNight: {
              ...(minPrice !== undefined && { gte: minPrice }),
              ...(maxPrice !== undefined && { lte: maxPrice }),
            },
          },
          select: {
            pricePerNight: true,
          },
        },
      },
    });

    const resData = hotels.map((hotel) => ({
      id: hotel.id,
      name: hotel.name,
      description: hotel.description,
      city: hotel.city,
      country: hotel.country,
      amenities: hotel.amenities,
      rating: hotel.rating,
      totalReviews: hotel.totalReviews,
      minPricePerNight:
        hotel.rooms.length > 0
          ? Math.min(...hotel.rooms.map((r) => r.pricePerNight.toNumber()))
          : null,
    }));

    res.json({
      success: true,
      data: resData,
      error: null,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: "INTERNAL_SERVER_ERROR",
    });
  }
});

app.get("/api/hotels/:hotelId",authMiddleware, async(req,res)=>{
    try {
        const hotelId = req.params.hotelId as string;

    const hotel = await prisma.hotel.findUnique({
        where:{
            id:hotelId,
        },
        include:{
            rooms:{
                select:{
                    id:true,
                    roomNumber:true,
                    roomType:true,
                    pricePerNight:true,
                    maxOccupancy:true
                },
            },
        },
    })
    if(!hotel){
        res.status(404).json({
            success:false,
            error:"HOTEL_NOT_FOUND"
        })
    }
    return res.status(200).json({
        success:true,
        data:hotel,
        error:null
    })
    } catch (e) {
        return res.status(500).json({
            success:false,
            data:null,
            error:"INTERNAL_SERVER_ERROR"
        });
    }
})

app.post("/api/bookings",authMiddleware,async(req,res)=>{
    const user = (req as any).user;

    if(user.role != "customer"){
        return res.status(403).json({
            
            success:false,
            error:"FORBIDDEN"
        })
    }
   
    const parsed = bookingSchema.safeParse(req.body);
    if(!parsed.success){
        return res.status(400).json({
            success:false,
            error:"INVALID_REQUEST"
        })
    }

    
    //checking guests capacity
    if(parsed.data.guests>9){
      return res.status(400).json({
        success:false,
        error:"INVALID_CAPACITY"
      })
    }

    //room exists 
    const room = await prisma.room.findUnique({
      where:{id:parsed.data.roomId}
    })
    if(!room){
      return res.status(404).json({
        success:false,
        error:"ROOM_NOT_FOUND"
      })
    }

     //booking for past date
    const today = new Date();
    today.setHours(0,0,0,0);

    const checkin = new Date(parsed.data.checkInDate);
    const checkout = new Date(parsed.data.checkOutDate);

    const referenceToday = new Date("2026-01-01");

    //checking checkout before checkin
    if(checkin>checkout){
      return res.status(400).json({
        success:false,
        error:"INVALID_REQUEST"
      })
    }

    if( checkin<referenceToday || checkout <= checkin){
      return res.status(400).json({
          success:false,
          error:"INVALID_DATES"
      })
    }
    
    // checking for overlapping dates, ignoring cancelled bookings
    const check = await prisma.booking.findFirst({
      where: {
        roomId: parsed.data.roomId,
        status: { not: BookingStatus.cancelled },
        AND: [
          {
            checkInDate: {
              lt: checkout,
            },
          },
          {
            checkOutDate: {
              gt: checkin,
            },
          },
        ],
      },
    });

    if (check) {
      return res.status(400).json({
        success: false,
        error: "ROOM_NOT_AVAILABLE"
      });
    }

    const nights = (checkout.getTime()-checkin.getTime())/(1000*60*60*24);
    const totalPrice = Number(nights) * Number(room.pricePerNight) ;

    const booking = await prisma.booking.create({
      data:{
        userId:user.id,
        roomId:room.id,
        hotelId:room.hotelId,
        checkInDate:parsed.data.checkInDate,
        checkOutDate:parsed.data.checkOutDate,
        guests:parsed.data.guests,
        totalPrice
      }
    })

    return res.status(201).json({
      success:true,
      data:{
        id:booking.id,
        userId:booking.userId,
        roomId:booking.roomId,
        hotelId:booking.hotelId,
        checkInDate:booking.checkInDate,
        checkOutDate:booking.checkOutDate,
        guests:booking.guests,
        totalPrice:Number(booking.totalPrice),
        status:booking.status,
        bookingDate:booking.bookingDate
      },error:null
    })
})


app.get("/api/bookings", authMiddleware, async (req, res) => {
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({
      success: false,
      data: null,
      error: "UNAUTHORIZED"
    });
  }

  try {
    const status =
      typeof req.query.status === "string"
        ? (req.query.status as BookingStatus)
        : undefined;

    const bookings = await prisma.booking.findMany({
      where: {
        userId: user.id,
        ...(status && { status })
      },
      include: {
        hotel: {
          select: { name: true }
        },
        room: {
          select: {
            roomNumber: true,
            roomType: true
          }
        }
      },
      orderBy: {
        bookingDate: "desc"
      }
    });

    const responseData = bookings.map((b) => ({
      id: b.id,
      roomId: b.roomId,
      hotelId: b.hotelId,
      hotelName: b.hotel.name,
      roomNumber: b.room.roomNumber,
      roomType: b.room.roomType,
      checkInDate: b.checkInDate,
      checkOutDate: b.checkOutDate,
      guests: b.guests,
      totalPrice: Number(b.totalPrice),
      status: b.status,
      bookingDate: b.bookingDate
    }));

    return res.status(200).json({
      success: true,
      data: responseData,
      error: null
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: "INTERNAL_SERVER_ERROR"
    });
  }
});

app.put("/api/bookings/:bookingId/cancel",authMiddleware,async (req, res) => {
    const user = (req as any).user;

    //Unauthorized
    if (!user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: "UNAUTHORIZED"
      });
    }

    const bookingId = req.params.bookingId as string;

    try {
      //Find booking
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId }
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          data: null,
          error: "BOOKING_NOT_FOUND"
        });
      }

      //Must be your booking
      if (booking.userId !== user.id) {
        return res.status(403).json({
          success: false,
          data: null,
          error: "FORBIDDEN"
        });
      }

      //Already cancelled
      if (booking.status === BookingStatus.cancelled) {
        return res.status(400).json({
          success: false,
          data: null,
          error: "ALREADY_CANCELLED"
        });
      }

      //24-hour cancellation rule
      const now = new Date();
      const checkIn = new Date(booking.checkInDate);

      const diffInMs = checkIn.getTime() - now.getTime();
      const diffInHours = diffInMs / (1000 * 60 * 60);

      if (diffInHours < 24) {
        return res.status(400).json({
          success: false,
          data: null,
          error: "CANCELLATION_DEADLINE_PASSED"
        });
      }

      
      // Update booking
      const updated = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.cancelled,
          cancelledAt: new Date()
        }
      });

      return res.status(200).json({
        success: true,
        data: {
          id: updated.id,
          status: updated.status,
          cancelledAt: updated.cancelledAt
        },
        error: null
      });

    } catch (err) {
      return res.status(500).json({
        success: false,
        data: null,
        error: "INTERNAL_SERVER_ERROR"
      });
    }
  }
);


// app.post("/api/reviews",authMiddleware, async (req,res)=>{

// })

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});