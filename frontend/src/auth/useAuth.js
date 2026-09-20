import { useContext } from "react";
import { AuthContext } from "./authContext.js";
export default function useAuth() { return useContext(AuthContext); }
