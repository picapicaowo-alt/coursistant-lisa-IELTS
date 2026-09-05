import {useTranslation} from 'react-i18next';
import styles from "./styles.module.scss";
import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import FileUploadBox from "./file-upload_ver2";
import RichTextEditor from "./rich-textarea";
import ChatComponent from "./chatbot";
const CreateContent = () => {
  const {t: translate} = useTranslation();
    const navigate = useNavigate();
    const { contentType } = useParams();
    const [isSubmitted, setIsSubmitted] = useState(true)
    const [isHavingContent, setIsHavingContent] = useState(false)
    const [isChatbotOpen, setIsChatbotOpen] = useState(false);
    // Dropdown state
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState("All File");
    // Example course list (replace with real data if available)
    const courseOptions = [
      "[CS01]Computer Science",
      "[CS01]Computer Science",
      "[CS01]Computer Science",
      "[CS01]Computer Science"
    ];
    return (

        <div className="w-full">
            {/* Header */}
            <div className="w-full flex items-center justify-between px-6 py-3 mb-2">
                {/* Back Button */}
                <button className="cursor-pointer hover:opacity-70 transition-opacity duration-300" type="button" aria-label={translate("common:actions.back")} title={translate("common:actions.back")} onClick={() => navigate(-1)}>
                    <img src="/icons/course/arrow-left-v2.png" alt="" />
                </button>
                {/* Title */}
                <div className="flex items-center ml-5 text-lg font-semibold">
                    <span className="text-[1.3rem] font-[400] text-[rgba(113,128,150,1)]">{contentType.charAt(0).toUpperCase() + contentType.slice(1)}</span>
                </div>
                <div className="flex-1" />
                {/* Publish Button */}
                <div className="flex space-x-2">
                {/* "View History" button */}
                <button
                    disabled
                    className="px-4 py-2 text-sm font-medium text-gray-400 bg-gray-100 rounded-lg cursor-pointer"
                >
                    View History
                </button>

                {/* Enabled "Create" button */}
                <button
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition ${
                    !isHavingContent
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-[rgba(86,111,232,1)] hover:bg-[rgba(65,88,200,1)] cursor-pointer"
                  }`}
                >
                    Create
                </button>
                </div>
            </div>
            <div className={styles.horizontalDivider}></div>
            {/* Course Units Content */}
            <div className="flex p-6 space-x-6">
                {/* Sidebar */}
                <div className="w-1/3">
                    {/* File Filter */}
                    <div className="flex items-center space-x-2 mb-4 relative">
                        <div className="relative">
                          <button
                            className="flex cursor-pointer items-center text-lg text-[rgba(45,55,72,1)] focus:outline-none"
                            onClick={() => setDropdownOpen((open) => !open)}
                          >
                            <span>{selectedCourse}</span>
                            <img src="/icons/add-content/arrow-down.png" alt="arrow-down" className="ml-2" />
                          </button>
                          {dropdownOpen && (
                            <div className="absolute left-0 mt-2 w-56 bg-white rounded-xl shadow-lg z-10 py-2 border border-gray-200">
                              {courseOptions.map((option, idx) => (
                                <div
                                  key={idx}
                                  className="px-4 py-2 text-[rgba(45,55,72,1)] hover:bg-gray-100 cursor-pointer text-base font-light"
                                  onClick={() => {
                                    setSelectedCourse(option);
                                    setDropdownOpen(false);
                                  }}
                                >
                                  {option}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex-1"/>
                        <div className={styles.correctedBox}>
                            <p className={`${styles.submitted} ${!isSubmitted ? styles.active : ""}`} onClick={() => {setIsSubmitted(false)}}>Submitted</p>
                            <p className={`${styles.notSubmitted} ${isSubmitted ? styles.active : ""}`} onClick={() => {setIsSubmitted(true)}}>Not Submitted</p>
                        </div>
                    </div>

                    {/* Assignment Cards */}
                    <div className="space-y-4">
                        {/* Card 1 */}
                        <div className="rounded-xl border-[1.5px] border-[rgba(203,213,224,1)] p-4">
                            <span className="text-xs bg-[rgba(34,204,238,1)] text-white px-2 py-1 rounded-full">Homework</span>
                            <h3 className="font-medium mt-2">[CS01] Social Practice</h3>
                            <div className="flex items-center justify-between gap-1">
                                <p className="text-sm text-gray-500">Due on Sep 9, 2024 11:59 PM</p>
                                <p className="text-sm text-gray-400">Score <span className="text-[rgba(113,128,150,1)]">- / 150</span></p>
                            </div>
                        </div>

                        {/* Card 2 */}
                        <div className="rounded-xl border-[1.5px] border-[rgba(203,213,224,1)] p-4">
                            <span className="text-xs bg-[rgba(47,184,143,1)] text-white px-2 py-1 rounded-full">Lab Manual</span>
                            <h3 className="font-medium mt-2">[CS01] Social Practice</h3>
                            <div className="flex items-center justify-between gap-1">
                                <p className="text-sm text-gray-500 flex items-center gap-1">
                                    <img src="/icons/add-content/info-circle.png" alt="check-circle" />
                                    This assignment has passed
                                </p>
                                <p className="text-sm text-gray-400">Score <span className="text-[rgba(113,128,150,1)]">- / 150</span></p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Panel */}
                <div className="w-2/3">
                    <h2 className="text-xl font-semibold mb-4">[CS01] Social Practice</h2>
                    <h3 className="text-sm mb-1">Upload Files</h3>
                    <h3 className="text-sm mb-4 text-[rgba(113,128,150,1)]">Max file size is 20MB. Supported file types are .pdf/ .doc/ .jpg/ .png/ .ppt</h3>
                    <FileUploadBox setIsHavingContent={setIsHavingContent}/>
                    <RichTextEditor />
                </div>
                </div>
                {/* Chatbot */}
                {!isChatbotOpen && (
                    <div className="fixed bottom-6 right-6 z-50">
                        <img src="/icons/add-content/chatbot.png" alt="Floating Icon"
                            className="rounded-full cursor-pointer hover:scale-110 transition-all duration-300"
                         onClick={() => {
                            setIsChatbotOpen(true);
                        }}/>
                    </div>
                )}
                {isChatbotOpen && <ChatComponent setIsChatbotOpen={setIsChatbotOpen}/>}
        </div>
    )
}
export default CreateContent;


