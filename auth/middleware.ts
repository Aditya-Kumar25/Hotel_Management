import type {Request  , Response , NextFunction } from "express";
import jwt from "jsonwebtoken";

export const authMiddleware = (
    req:Request,
    res:Response,
    next : NextFunction
) =>{
    const authHeader = (req.headers as any).get?.("authorization") || (req.headers as any).get?.("authorization");


    if(!authHeader){
        return res.status(401).json({ error: 'No token provided' });
    }

    const token =authHeader.split(' ')[1];

    
    try {
        const decoded =jwt.verify(token, process.env.JWT_SECRET as string);
        (req as any).user = decoded;
        next();
    } catch (e) {
        res.status(401).json({error:'Invalid or Expired token'})
    }
} 
    