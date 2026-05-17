import { GoogleLogin } from "@react-oauth/google";
import API from "../../api/axios";

const GoogleLoginButton = () => {
  const handleSuccess = async (credentialResponse) => {
    try {
      const res = await API.post(
        "/auth/google",
        {
          token: credentialResponse.credential,
        },
        {
          withCredentials: true,
        }
      );

      console.log(res.data);

      const user = res.data.user;

      if (user.role === "admin") {
        window.location.href = "/admin";
      } else if (!user.profileCompleted) {
        window.location.href = "/complete-profile";
      } else {
        window.location.href = "/dashboard";
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <GoogleLogin
      onSuccess={handleSuccess}
      onError={() => console.log("Google Login Failed")}
    />
  );
};

export default GoogleLoginButton;