import {createContext ,useContext , useState ,useEffect} from "react";
import api, { setAccessToken } from "../apiInterceptor";
export interface authContextType {
    isAuthenticated : boolean;
    user : any;
    loading : boolean;
    checkAuthentication : () => Promise<void>;
}

const authContext = createContext<authContextType | null>(null);

export const AuthContextProvider =  ({children} : {children : React.ReactNode})=>{
    const [isAuthenticated , setIsAuthenticated] = useState(false);
    const [user , setUser] = useState(null);
    const [loading , setLoading] = useState(true);

    useEffect(()=>{
        checkAuthentication();
    },[])

   const checkAuthentication = async () => {
    try {
        const response = await api.post("/refresh");
        if (response?.data) {
            const { accessToken, user } = response.data;
            setAccessToken(accessToken);
            setUser(user);
            setIsAuthenticated(true);
        }
    } catch (error) {
        setAccessToken(null);
        setIsAuthenticated(false);
        setUser(null);
    } finally {
        setLoading(false);
    }
};
    return (
        <authContext.Provider value={{isAuthenticated , user , loading , checkAuthentication}}>
            {children}
        </authContext.Provider>
    )
}

export const useAuthContext = () => {
    const context = useContext(authContext);
    if (!context) {
        throw new Error("useAuthContext must be used within an authContextProvider");
    }
    return context;
}