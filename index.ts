import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { signUp,logIn,hotelSchema } from './auth/validation';
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client'
import { authMiddleware } from './auth/middleware';
import express from 'express'


    console.log("1")
    const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    })

    export const prisma = new PrismaClient({ adapter })

    dotenv.config();

    const app = express();

    app.use(express.json());

    app.post('/api/auth/signup' , async(req,res)   =>{
        console.log("2")
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
        console.log("hello")
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

    app.post("/api/auth/hotel" ,authMiddleware,(req,res)=>{
        const user = (req as any).user;

        const parsed = hotelSchema.safeParse(req.body);

        // if(role != "owner"){
        //     return res.status(403).json({
        //         success:false,
        //         error:"FORBIDDEN"
        //     })
        // }
    })

    app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
    });