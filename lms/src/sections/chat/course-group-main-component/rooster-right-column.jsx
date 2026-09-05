import { useState, useEffect, useRef } from "react";
export default function RoosterRightColumn ({users}) {
    const [selectedUser, setSelectedUser] = useState(null);
    const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0 });
    const panelRef = useRef(null);
    
    // Close on outside click
    useEffect(() => {
      function handleClickOutside(event) {
        if (panelRef.current && !panelRef.current.contains(event.target)) {
          setSelectedUser(null);
        }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
  
    const handleUserClick = (event, user) => {
      const rect = event.currentTarget.getBoundingClientRect();
      setPanelPosition({ top: rect.top + window.scrollY, left: rect.left - 280 });
      setSelectedUser(user);
    };

    return (
        <>
        {/* Roster List */}
        <div className="flex flex-col gap-4">
          {["TEACHER", "STUDENT"].map(level => (
            <div key={level}>
              <h2 className="text-xs font-semibold text-gray-500 uppercase mb-2">{level}</h2>
              {users
                .filter(user => user.level === level)
                .map(user => (
                  <div
                    key={user.email}
                    className="flex items-center gap-2 py-2 cursor-pointer hover:bg-gray-100 rounded-md"
                    onClick={(e) => handleUserClick(e, user)}
                  >
                    <img src={user.profile} alt={user.name} className="w-10 h-10 rounded-full" />
                    <h3 className="text-sm font-medium">{user.name}</h3>
                  </div>
                ))}
            </div>
          ))}
        </div>
  
        {/* Floating Profile Panel */}
        {selectedUser && (
          <div
            ref={panelRef}
            className="absolute z-50 w-[260px] bg-white shadow-lg rounded-lg p-4 flex flex-col items-start"
            style={{ top: panelPosition.top, left: panelPosition.left }}
          >
            <img
              src={selectedUser.profile}
              alt={selectedUser.name}
              className="w-16 h-16 rounded-full border border-gray-300"
            />
            <h2 className="mt-3 text-center text-lg font-semibold text-[rgba(45,55,72,1)]">{selectedUser.name}</h2>
            <p className="text-center text-[rgba(113,128,150,1)]">{selectedUser.major}</p>
            <p className="mt-2 text-center text-sm text-[rgba(113,128,150,1)]">{selectedUser.email}</p>
            <button className="mt-4 w-full border border-[rgba(203,213,224,1)] text-[rgba(113,128,150,1)] py-1.5 cursor-pointer rounded hover:bg-[rgba(248,249,250,1)]">
              Message @{selectedUser.name.split(" ")[0]}
            </button>
          </div>
        )}
        </>
    )
}