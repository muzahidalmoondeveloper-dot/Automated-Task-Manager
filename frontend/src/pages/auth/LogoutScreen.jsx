import { useState } from "react";
import {useAuth} from '../../context/AuthContext';
import toast from "react-hot-toast";
import { Link,replace,useNavigate } from "react-router-dom";
export default function LogoutScreen() {
  const {user,logout} = useAuth();
  var userName = user && user['full_name'];
  var userEmail = user && user['email'];
  
  const [loggedOut, setLoggedOut] = useState(false);
  const [loading,setLoading] = useState(false);

  const navigate = useNavigate();

  async function handleLogout() {
    try{
      setLoggedOut(false);
      setLoading(true);
      const response = await logout();

      if(response){
        toast.success("logout successful")
      }
      setLoading(false);
      setLoggedOut(true);

    }catch(error){
      setLoading(false);
      console.log(error)
      toast.error("something wrong on logout");
    }
  }

  if (loggedOut) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-lg font-medium text-zinc-100 mb-1">You've been logged out</p>
          <p className="text-sm text-zinc-400 mb-6">
            See you next time, {userName && userName.split(" ")[0]}!
          </p>
          <button
            onClick={() => navigate('/login') }
            className="w-full py-2.5 rounded-lg border border-zinc-700 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            Sign back in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 w-full max-w-sm text-center">

        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>

        {/* User info */}
        <p className="text-lg font-medium text-zinc-100 mb-1">{userName}</p>
        <p className="text-sm text-zinc-500 mb-6">{userEmail}</p>

        <hr className="border-zinc-800 mb-6" />

        <p className="text-sm text-zinc-400 leading-relaxed mb-6">
          Are you sure you want to log out? You'll need to sign in again to access your account.
        </p>

        {/* Log out button */}
        <button
          onClick={handleLogout}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-900 bg-red-950 text-red-400 text-sm font-medium hover:bg-red-900 hover:text-red-300 transition-colors cursor-pointer mb-2.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          { loading ? "Loading..." : "Log Out"}
        </button>

        {/* Cancel button */}
        <button
          onClick={()=> { navigate('/') }}
          className="w-full py-2.5 rounded-lg border border-zinc-700 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          Cancel
        </button>

      </div>
    </div>
  );
}
