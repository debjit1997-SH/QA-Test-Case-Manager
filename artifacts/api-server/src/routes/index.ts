import { Router, type IRouter } from "express";
import healthRouter from "./health";
import qaRouter from "./qa";

const router: IRouter = Router();

router.use(healthRouter);
router.use(qaRouter);

export default router;
