import React, { useRef } from "react";
import { Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadProps {
  onImageSelect: (file: File, preview: string) => void;
  className?: string;
}

export function ImageUpload({ onImageSelect, className = "" }: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        
        img.onload = () => {
          // Create a canvas to resize the image
          const canvas = document.createElement('canvas');
          
          // Calculate new dimensions - max width/height of 600px (reduced from 800px)
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 600;
          
          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Draw the resized image
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Get the compressed data URL with increased compression (JPEG format, 0.6 quality)
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
          resolve(compressedDataUrl);
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Check file size first (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      console.error("File too large:", file.size);
      toast({
        title: "Image too large",
        description: "Please select a smaller image (max 10MB).",
        variant: "destructive",
      });
      event.target.value = ''; // Clear the input
      return;
    }
    
    // Validate image type
    if (!file.type.startsWith('image/')) {
      console.error("Invalid file type:", file.type);
      toast({
        title: "Invalid file",
        description: "Please select a valid image file.",
        variant: "destructive",
      });
      event.target.value = ''; // Clear the input
      return;
    }
    
    try {
      // Compress the image before sending
      const compressedImageDataUrl = await compressImage(file);
      
      // Create a new File object from the compressed image
      const compressedBlob = await fetch(compressedImageDataUrl).then(r => r.blob());
      const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });
      
      // Check if the compressed image is still too large (max 5MB for server)
      if (compressedBlob.size > 5 * 1024 * 1024) {
        console.warn("Compressed image still too large:", compressedBlob.size);
        toast({
          title: "Image too large",
          description: "Image is still too large after compression. Please use a smaller image or one with less detail.",
          variant: "destructive",
        });
        event.target.value = ''; // Clear the input
        return;
      }
      
      // Pass both the file and the preview URL
      onImageSelect(compressedFile, compressedImageDataUrl);
      
      // Reset the file input to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error("Error compressing image:", error);
      toast({
        title: "Processing error",
        description: "Error processing image. Please try another image.",
        variant: "destructive",
      });
      event.target.value = ''; // Clear the input
    }
  };

  return (
    <>
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileUpload}
      />
      <button
        type="button"
        className={className}
        onClick={() => fileInputRef.current?.click()}
        title="Upload food photo"
      >
        <Camera className="h-5 w-5" />
      </button>
    </>
  );
}