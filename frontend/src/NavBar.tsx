import { useState, useEffect } from "react";
import { Button } from "./components/ui/button";
import { Menu, X, Car } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

// 1. Extract links to an array to keep the code DRY
const NAV_LINKS = [
  { name: "Ride", href: "#" },
  { name: "Drive", href: "#" },
  { name: "Business", href: "#" },
  { name: "About", href: "#" },
];

function NavBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate()

  // 2. Detect scroll for a sleek glassmorphism effect
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 3. Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isOpen]);

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? "bg-black/80 backdrop-blur-md shadow-lg" : "bg-black"
        } text-white`}
    >

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <div className="flex  items-center justify-center gap-3 ">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white">
            <Car size={20} className="text-black" />
          </div>
          <h1 className="cursor-pointer text-3xl font-bold tracking-tight transition-opacity hover:opacity-80">
            Uber
          </h1>

        </div>


        {/* Desktop Navigation */}
        <ul className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.name}>
              <a
                href={link.href}
                className="relative text-sm font-medium text-gray-200 transition-colors hover:text-white
                           after:absolute after:-bottom-1 after:left-0 after:h-[2px] after:w-0
                           after:bg-white after:transition-all after:duration-300 hover:after:w-full"
              >
                {link.name}
              </a>
            </li>
          ))}
        </ul>

        {/* Desktop Buttons */}
        <div className="hidden items-center gap-3 md:flex">
          <Button
            variant="ghost"
            className="rounded-full text-white transition-colors hover:bg-white/10"
            onClick={() => navigate("/login")}
          >
            Log in
          </Button>

          <Button className="rounded-full bg-white px-5 text-black transition-transform hover:scale-105 hover:bg-gray-200"
          onClick={() => navigate("/signup")}>
            Sign up
          </Button>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="rounded-md p-2 -mr-2 transition-colors hover:bg-white/10 md:hidden"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label="Toggle navigation menu"
        >
          {isOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Menu with Framer Motion */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "calc(100vh - 4rem)" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="absolute left-0 top-16 w-full overflow-hidden border-t border-gray-800 bg-black px-6 md:hidden"
          >
            <div className="flex h-full flex-col py-6">
              <ul className="flex flex-col gap-6">
                {NAV_LINKS.map((link, index) => (
                  <motion.li
                    key={link.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <a
                      href={link.href}
                      className="block text-3xl font-semibold transition-colors hover:text-gray-300"
                      onClick={() => setIsOpen(false)} // Close menu on click
                    >
                      {link.name}
                    </a>
                  </motion.li>
                ))}
              </ul>

              <div className="mt-8 flex flex-col gap-4 border-t border-gray-800 pt-8">
                <Button
                  variant="ghost"
                  className="w-full justify-center rounded-full py-6 text-lg text-white hover:bg-white/10"
                  onClick={() => {
                    setIsOpen(false);
                    navigate("/login");
                  }}
                >
                  Log in
                </Button>

                <Button
                  className="w-full rounded-full bg-white py-6 text-lg text-black hover:bg-gray-200"
                  onClick={() => {
                    setIsOpen(false);
                    navigate("/signup");
                  }}
                >
                  Sign up
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

export default NavBar;
