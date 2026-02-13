import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { signUp,logIn,hotelSchema,roomSchema } from './auth/validation';
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client'
import { authMiddleware } from './auth/middleware';
import express from 'express'
import { safeParse, success } from "zod";
import { connect } from "bun";
import { id } from "zod/locales";


    dotenv.config();
    console.log("1")
    const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    })

    export const prisma = new PrismaClient({ adapter })

    

    const app = express();

    app.use(express.json());

    app.post('/api/auth/signup' , async(req,res)   =>{
        const payload = req.body;
        const parse = signUp.safeParse(payload);

        if(!parse.success){
            return res.status(400).json({
                "success":false,
                "data":null,
                "error":"INVALID_REQUEST"
            })
        }

        const ezmail = parse.data.email.toLowerCase();

        const existing = await prisma.user.findUnique({where:{email:ezmail}})
        if(existing){
            return res.status(400).json({
                success:false,
                data:null,
                error:"EMAIL_ALREADY_EXISTS"
            })
        }

        try {
            const hash =  await bcrypt.hash(payload.password,10);

        const user =await prisma.user.create({
            data:{name:parse.data.name,
            email:ezmail,
            password:hash,
            role:parse.data.role,
            phone:parse.data.phone ?? null
        }
        })

        res.status(201).json({success:true,data:{
            id:user.id,
            name:user.name,
            email:user.email,
            ...(user.phone && {phone:user.phone}),
            role:user.role
        },error:null});

        } catch (error) {
            console.error(error);
            res.status(400).json({msg:"Server error"});
        }
        
    });
    

    app.post("/api/auth/login" ,async (req,res)=>{
        const payload = req.body;
        const parse = logIn.safeParse(payload);

        if(!parse.success){
            return res.status(400).json({
                "success":false,
                "data":null,
                "error":"INVALID_REQUEST"
            })
        }



        const us = await prisma.user.findUnique({where:{email:parse.data.email.toLowerCase()},});
        if(!us){return res.status(401).json({
            success:false,
            data:null,
            error:"INVALID_CREDENTIALS"
         })};

        const pwd = await bcrypt.compare(parse.data.password,us.password)
        if(!pwd){return res.status(401).json({
            success:false,
            data:null,
            error:"INVALID_CREDENTIALS"
        })};

        
        try {
            const token = jwt.sign({
            id:us.id,
            role: us.role
        },
            process.env.JWT_SECRET as string,
            {expiresIn : '1d'},
        );
        res.json({success:true,
            data:{
                token,
                user:{
                    id:us.id,
                    name:us.name,
                    email:us.email,
                    role:us.role
                }
            },
            error:null
        });
        } catch (err) {
            console.error(err);
            res.status(400).json({msg:"Server Error"})
        }

    })

    app.post("/api/hotels" ,authMiddleware,async(req,res)=>{
        const user = (req as any).user;
        console.log(user);
        if(user.role != "owner"){
            return res.status(403).json({
                success:false,
                error:"FORBIDDEN"
            })
        }

        const parsed = hotelSchema.safeParse(req.body);
        console.log(parsed.data)
        if(!parsed.success){
            return res.status(400).json({
                success:false,
                error:"INVALID_REQUEST"
            })
        }

        try {
            const hotel = await prisma.hotel.create({
            data:{
                name:parsed.data.name,
                city:parsed.data.city,
                country:parsed.data.country,
                description:parsed.data.description??null,
                rating:0.0,
                amenities:parsed.data.amenities ?? [],
                totalReviews:0,

                owner: {
                    connect: {
                        id: user.id
                    }
                }
            }
        })

        return res.status(201).json({
            success: true,
            data:{
                id:hotel.id,
                ownerId:hotel.ownerId,
                name:hotel.name,
                city:hotel.city,
                country:hotel.country,
                rating:Number(hotel.rating),
                totalReviews:hotel.totalReviews,
                amenities:hotel.amenities
            } ,
            error:null
        })

        } catch (error) {
            return res.status(500).json({
                success:false,
                data:null,
                error:"INTERNAL_SERVER_ERROR"
            })
        }
    })

    app.post("/api/hotels/:hotelId/rooms",authMiddleware, async(req,res)=>{
        const user =  (req as any).user;
        const hotelId  = req.params.hotelId as string;
        const dataa = req.body;

        const parsed = roomSchema.safeParse(dataa);

       
        if(!parsed.success){
            return res.status(400).json({
                success:false,
                error:"INVALID_REQUEST"
            })
        }

        const hotelexists = await prisma.hotel.findUnique({
            where:{
                id:hotelId
            }
        })

        if(!hotelexists){
            return res.status(404).json({
                success:false,
                error:"HOTEL_NOT_FOUND"
            })
        }
         
        if(hotelexists.ownerId !== user.id){
            return res.status(403).json({
                success:false,
                error:"FORBIDDEN"
            })
        }

        const {roomNumber} = parsed.data;

        const roomexists = await prisma.room.findUnique({
            where:{
                hotelId_roomNumber:{
                    hotelId,
                    roomNumber
                }
            }
        })

        if(roomexists){
            return res.status(400).json({
                success:false,
                error:"ROOM_ALREADY_EXISTS"
            })
        }

        const room = await prisma.room.create({
            data:{
                roomNumber:parsed.data.roomNumber,
                roomType :parsed.data.roomType,
                pricePerNight : parsed.data.pricePerNight,
                maxOccupancy:parsed.data.maxOccupancy,
                hotel:{
                    connect:{
                        id:hotelId
                    }
                }
            }
        })
        console.log(room)
        return res.status(201).json({
            success:true,
            data:{
                id:room.id,
                hotelId:room.hotelId,
                roomNumber:room.roomNumber,
                roomType:room.roomType,
                pricePerNight:Number(room.pricePerNight),
                maxOccupancy:room.maxOccupancy
            },
            error:null
        })

    })

    app.get("/api/hotels",authMiddleware, async (req, res) => {
try{
            const city = typeof req.query.city === "string" ? req.query.city : undefined;
            const country = typeof req.query.country === "string" ? req.query.country : undefined;
            const minPrice = typeof req.query.minPrice === "string" ? Number(req.query.minPrice) : undefined;
            const maxPrice = typeof req.query.maxPrice === "string" ? Number(req.query.maxPrice) : undefined;
            const minRating = typeof req.query.minRating === "string" ? Number(req.query.minRating) : undefined;
            
            const whereClause : any = {
                AND:[
                    city
                    ?{
                        city:{
                            equals:city,
                            mode:"insensitive"
                        },
                    }:{},
                
                country
                    ?{
                        country:{
                            equals:country,
                            mode:"insensitive"
                        },
                    }
                    :{},

                minRating
                        ?{
                            rating:{
                                gte:Number(minRating),
                            },
                        }:{},
                minPrice||maxPrice
                            ?{
                                rooms:{
                                    some:{
                                        pricePerNight:{
                                            gte:minPrice?Number(minPrice) : undefined,
                                            lte : maxPrice?Number(maxPrice) :undefined,
                                        },
                                    },
                                },
                            }
                            :{}
                ],
            };

            const hotels = await prisma.hotel.findMany({
                where:whereClause,
                include:{
                    rooms:{
                        select:{
                            pricePerNight:true,
                        },
                    },
                },
            })

            const resData = hotels.filter(hotel=>hotel.rooms.length>0)
                            .map(hotel => ({
                                id:hotel.id,
                                name:hotel.name,
                                description:hotel.description,
                                city: hotel.city,
                country: hotel.country,
                amenities: hotel.amenities,
                rating: hotel.rating,
                totalReviews: hotel.totalReviews,
                minPricePerNight: Math.min(...hotel.rooms.map(r => r.pricePerNight.toNumber())),
            }));

        res.json({  
            success: true,
            data: resData,
            error: null,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            data: null,
            error: "INTERNAL_SERVER_ERROR",
        });
    }
    });



    app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
    });