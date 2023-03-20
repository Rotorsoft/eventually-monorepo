import { Request, Response } from "express";
import { readHomeView } from "../utils";

export const home = async (_: Request, res: Response): Promise<void> => {
  try {
    res.render("home", await readHomeView());
  } catch (error) {
    console.log(error);
  }
};
