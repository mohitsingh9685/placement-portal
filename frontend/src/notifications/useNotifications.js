import { useContext } from "react";
import { NotificationContext } from "./notificationContext.js";
export default function useNotifications() { return useContext(NotificationContext); }
