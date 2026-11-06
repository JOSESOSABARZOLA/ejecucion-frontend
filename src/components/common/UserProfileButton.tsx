import { type FC } from "react";
import { useUser } from "../../context/UserContext";
// import { useUser } from "../../context/UserContext";

type PerfilUsuarioBotonProps = {
  onClick: () => void;
};

const UserProfileButton: FC<PerfilUsuarioBotonProps> = ({ onClick }) => {
  const { user } = useUser();

  const abreviaturaPerfil = user?.usuFullName
    ? user.usuFullName
        .split(" ")
        .map((n) => n.charAt(0).toUpperCase())
        .join("")
    : "U";
  
  return (
    <div
      className="avatar avatar-online avatar-placeholder ml-2 cursor-pointer"
      onClick={onClick}
    >
      <div className="w-9 rounded-full bg-primary text-primary-content ring-2 ring-base-200 shadow-sm transition-colors">
        <span className="text-xs font-semibold tracking-wide">
          {abreviaturaPerfil}
        </span>
      </div>
    </div>
  );
};

export default UserProfileButton;
