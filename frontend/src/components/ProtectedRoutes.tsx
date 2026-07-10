import LoadingScreen from "./LoadingScreen";

import { useAuthContext , type authContextType } from "../context/authContext";
import { Outlet } from "react-router-dom";
import UnauthorizedPage from "./UnauthorizedPage";

export const ProtectedRoutes = ({allowedroles } : {allowedroles : string[]}) => {

    const {user , isAuthenticated , loading} = useAuthContext() as authContextType;

    if(loading){
        return <LoadingScreen></LoadingScreen>
    }
    if(!isAuthenticated){
        return <UnauthorizedPage/>
    }
    console.log(user.role)
    if(allowedroles && !allowedroles.includes(user.role)){
        return <UnauthorizedPage/>
    }

    return (
        <Outlet/>
    )

}