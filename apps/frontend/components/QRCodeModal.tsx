import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  eventName: string;
}

export function QRCodeModal({ isOpen, onClose, url, eventName }: QRCodeModalProps) {
  const handlePrint = () => {
    const svgContent = document.getElementById('qr-svg-wrapper')?.innerHTML;
    if (!svgContent) return;

    // Create an invisible iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) return;

    // Build the isolated document
    iframeDoc.write(`
      <html>
        <head>
          <title>Print QR Code - ${eventName}</title>
          <style>
             @page { margin: 1cm; }
             body { 
               margin: 0; 
               font-family: system-ui, -apple-system, sans-serif;
               display: flex;
               align-items: center;
               justify-content: center;
               width: 100vw;
               height: 100vh;
               background: white;
             }
             .content-box {
               text-align: center;
               display: flex;
               flex-direction: column;
               align-items: center;
             }
             h2 {
               font-size: 3rem;
               margin: 0 0 0.5rem 0;
               color: #111827;
             }
             p.scan {
               font-size: 1.5rem;
               color: #6B7280;
               margin: 0 0 3rem 0;
               text-transform: uppercase;
               letter-spacing: 0.1em;
               font-weight: 500;
             }
             .svg-container {
               padding: 2.5rem;
               border: 3px solid #F3F4F6;
               border-radius: 2rem;
               background: white;
             }
             .svg-container svg {
               width: 500px;
               height: 500px;
               display: block;
             }
             p.url {
               font-size: 1.25rem;
               color: #9CA3AF;
               font-family: monospace;
               margin: 3rem 0 0 0;
               word-break: break-all;
             }
          </style>
        </head>
        <body>
          <div class="content-box">
             <h2>${eventName}</h2>
             <p class="scan">Scan to Upload Photos</p>
             <div class="svg-container">
               ${svgContent}
             </div>
             <p class="url">${url}</p>
          </div>
        </body>
      </html>
    `);

    iframeDoc.close();

    // Small delay to ensure styles and SVG are fully loaded in the iframe
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      // Cleanup after print dialog opens
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 100);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            id="qr-modal-container"
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-3xl p-8 shadow-2xl z-[101] w-[90vw] max-w-sm flex flex-col items-center gap-6"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 rounded-full hover:bg-gray-100 text-gray-500"
              onClick={onClose}
            >
              <X className="w-5 h-5" />
            </Button>
            
            <div className="text-center space-y-2 mt-4">
              <h2 className="text-2xl font-bold text-gray-900">{eventName}</h2>
              <p className="text-sm text-gray-500 font-medium tracking-wide uppercase">Scan to Upload Photos</p>
            </div>

            <div id="qr-svg-wrapper" className="bg-white p-4 rounded-2xl shadow-inner border border-gray-100 flex items-center justify-center">
              <QRCodeSVG 
                value={url} 
                size={220} 
                level="H"
                includeMargin={true}
                className="rounded-xl"
              />
            </div>
            
            <p className="text-xs text-gray-400 font-mono break-all text-center px-4">
              {url}
            </p>

            <Button 
                onClick={handlePrint} 
                className="w-full rounded-xl gap-2 bg-black hover:bg-gray-800 text-white"
                size="lg"
            >
              <Printer className="w-4 h-4" />
              Print QR Code
            </Button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
