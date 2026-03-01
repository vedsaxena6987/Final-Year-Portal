// src/components/dashboard/shared/Footer.jsx
"use client";

import { Linkedin, Mail, Phone } from 'lucide-react';
import Image from 'next/image';

/**
 * Footer Component
 * Displays creator information for the Final Year Portal
 * 
 * @param {boolean} showPhoneNumbers - Whether to display WhatsApp contact info (true for faculty, false for students/external)
 */
export default function Footer({ showPhoneNumbers = false }) {
    const currentYear = new Date().getFullYear();
    const startYear = 2025;
    const yearDisplay = currentYear > startYear ? `${startYear}-${currentYear}` : startYear;

    const creators = [
        {
            name: "Vedant Saxena",
            linkedin: "https://www.linkedin.com/in/vedant-saxena-60012a238/",
            email: "6987vedsaxena@gmail.com",
            phone: "6306145403",
            photo: "/aditya.jpg" // Add your photo to public folder
        }
    ];

    return (
        <footer className="mt-auto border-t border-slate-200/60 bg-gradient-to-b from-slate-50/98 to-slate-100 backdrop-blur-sm">
            <div className="max-w-4xl mx-auto px-4 py-3">
                {/* Professional Header */}
                <p className="text-center text-xs text-slate-600 mb-2">
                    Developed & Maintained by
                </p>

                {/* Creator Cards */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mb-2">
                    {creators.map((creator, index) => (
                        <div
                            key={creator.name}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/70 backdrop-blur-sm border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200"
                        >
                            {/* Photo */}
                            <div className="flex-shrink-0">
                                <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-slate-200 shadow-sm">
                                    <Image
                                        src={creator.photo}
                                        alt={creator.name}
                                        width={48}
                                        height={48}
                                        className="object-cover w-full h-full"
                                        priority
                                    />
                                </div>
                            </div>

                            {/* Name and Links */}
                            <div className="flex flex-col gap-1.5">
                                {/* Name */}
                                <span className="text-sm font-semibold text-slate-700">
                                    {creator.name}
                                </span>

                                {/* Links */}
                                <div className="flex items-center gap-2">
                                    {/* Email */}
                                    <a
                                        href={`mailto:${creator.email}`}
                                        className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                        title={`Email ${creator.name}`}
                                    >
                                        <Mail className="h-4 w-4" />
                                    </a>

                                    {/* LinkedIn */}
                                    <a
                                        href={creator.linkedin}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                        title={`${creator.name}'s LinkedIn`}
                                    >
                                        <Linkedin className="h-4 w-4" />
                                    </a>

                                    {/* Phone (WhatsApp) - Only shown for faculty */}
                                    {showPhoneNumbers && (
                                        <a
                                            href={`https://wa.me/91${creator.phone}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1.5 rounded-md text-slate-500 hover:text-green-600 hover:bg-green-50 transition-colors"
                                            title={`WhatsApp ${creator.name}`}
                                        >
                                            <Phone className="h-4 w-4" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Support Text & Copyright */}
                <p className="text-center text-[11px] text-slate-500">
                    For queries or support, reach out via the contact links above
                </p>
                <p className="text-center text-[10px] text-slate-400 mt-1">
                    © {yearDisplay} GEHU CSE Department
                </p>
            </div>
        </footer>
    );
}
