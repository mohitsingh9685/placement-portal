import { useParams } from "react-router-dom";
import DriveEditor from "../components/DriveEditor";
export default function EditCompany() { const { id } = useParams(); return <DriveEditor key={id} id={id} />; }
