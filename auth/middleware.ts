import type {Request  , Response , NextFunction } from "express";
import jwt from "jsonwebtoken";


export const authMiddleware = (
    req:Request,
    res:Response,
    next : NextFunction
) =>{
    const authHeader = req.headers.authorization; 
    console.log(authHeader)
    if(!authHeader || !authHeader.startsWith("Bearer ")){
        return res.status(401).json({
                "success": false,
                "data": null,
                "error": "UNAUTHORIZED"
            });
    }

    const token =authHeader.split(' ')[1];
    console.log(token)
    try {
        const decoded =jwt.verify(token as string, process.env.JWT_SECRET as string);
        console.log(decoded);
        (req as any).user = decoded;
        next();
    } catch (e) {
        return res.status(401).json({
                "success": false,
                "data": null,
                "error": "UNAUTHORIZED"
            });
    }
} 
    