import { Router, type IRouter } from "express";
import { GetScreenersResponse } from "@workspace/api-zod";
import { getScreeners } from "../lib/screeners";

const router: IRouter = Router();

router.get("/screeners", async (req, res): Promise<void> => {
  const screeners = await getScreeners();
  req.log.info(
    { counts: screeners.map((s) => ({ key: s.key, count: s.stocks.length })) },
    "Screeners served",
  );
  res.json(GetScreenersResponse.parse(screeners));
});

export default router;
