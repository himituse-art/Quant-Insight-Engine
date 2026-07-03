import { Router, type IRouter } from "express";
import healthRouter from "./health";
import stocksRouter from "./stocks";
import screenersRouter from "./screeners";

const router: IRouter = Router();

router.use(healthRouter);
router.use(stocksRouter);
router.use(screenersRouter);

export default router;
