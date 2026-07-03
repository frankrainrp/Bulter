import { Router } from "express";
import { AddSession, AddUser, CheckUserPassword, DeleteSession, GetUserBySession } from "../services/AuthService.js";
import { ClearAuthCookie, ReadCookie, SetAuthCookie, AUTH_COOKIE } from "../utils/CookieTools.js";
import { MakeFail, MakeOk } from "../utils/ApiResponse.js";
import { RunSafe } from "../utils/RunSafe.js";

export const AuthRoutes = Router();

AuthRoutes.get(
  "/me",
  RunSafe(async (req, res) => {
    const sessionId = ReadCookie(req, AUTH_COOKIE);
    const user = await GetUserBySession(sessionId);
    res.json(MakeOk({ user }));
  }),
);

AuthRoutes.post(
  "/signup",
  RunSafe(async (req, res) => {
    const user = await AddUser(req.body);
    const session = await AddSession(user.id);
    SetAuthCookie(res, session.sessionId, session.expiresAt);
    res.status(201).json(MakeOk({ user }));
  }),
);

AuthRoutes.post(
  "/login",
  RunSafe(async (req, res) => {
    const user = await CheckUserPassword(req.body);
    if (!user) {
      res.status(401).json(MakeFail("Email or password is incorrect."));
      return;
    }

    const session = await AddSession(user.id);
    SetAuthCookie(res, session.sessionId, session.expiresAt);
    res.json(MakeOk({ user }));
  }),
);

AuthRoutes.post(
  "/logout",
  RunSafe(async (req, res) => {
    const sessionId = ReadCookie(req, AUTH_COOKIE);
    await DeleteSession(sessionId);
    ClearAuthCookie(res);
    res.json(MakeOk({ user: null }));
  }),
);

