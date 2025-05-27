"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { LayoutGrid, Search, Upload, LogOut } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { getSupabaseClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"

interface FileItem {
  id: string
  name: string
  original_name: string
  file_type: string
  file_size: number
  storage_path: string
  created_at: string
}

interface FolderItem {
  id: string
  name: string
  created_at: string
}

interface NavItemProps {
  href: string
  icon: React.ReactNode
  children: React.ReactNode
  active?: boolean
}

function NavItem({ href, icon, children, active }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-sm text-gray-300 rounded-lg hover:bg-gray-700",
        active && "bg-gray-700 text-white",
      )}
    >
      {icon}
      <span>{children}</span>
    </Link>
  )
}

function FolderItemComponent({ folder }: { folder: FolderItem }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 cursor-pointer rounded-lg">
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
        />
      </svg>
      <span>{folder.name}</span>
    </div>
  )
}

function FileCard({
  file,
  onDelete,
  onDownload,
}: { file: FileItem; onDelete: (file: FileItem) => void; onDownload: (file: FileItem) => void }) {
  const [imageUrl, setImageUrl] = useState<string>("")
  const supabase = getSupabaseClient()

  useEffect(() => {
    const getImageUrl = async () => {
      if (file.file_type.startsWith("image/")) {
        const { data } = await supabase.storage.from("user-files").createSignedUrl(file.storage_path, 3600)

        if (data?.signedUrl) {
          setImageUrl(data.signedUrl)
        }
      }
    }

    getImageUrl()
  }, [file, supabase])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  return (
    <div className="group relative overflow-hidden rounded-lg border border-gray-700 bg-gray-800">
      <div className="aspect-[4/3] overflow-hidden bg-gray-700 flex items-center justify-center">
        {file.file_type.startsWith("image/") && imageUrl ? (
          <Image
            src={imageUrl || "/placeholder.svg"}
            alt={file.original_name}
            width={400}
            height={300}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="text-gray-400 text-4xl">📄</div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-medium text-white truncate">{file.original_name}</h3>
        <p className="text-sm text-gray-400">
          {formatFileSize(file.file_size)} • {new Date(file.created_at).toLocaleDateString()}
        </p>
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDownload(file)}
            className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            Descargar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDelete(file)}
            className="flex-1 border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
          >
            Eliminar
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function FileManager({ user }: { user: User }) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const router = useRouter()
  const supabase = getSupabaseClient()

  useEffect(() => {
    loadFiles()
    loadFolders()
  }, [])

  const loadFiles = async () => {
    try {
      console.log("Loading files for user:", user.id)

      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error loading files details:", error)
        throw new Error(`Failed to load files: ${error.message || JSON.stringify(error)}`)
      }

      console.log("Files loaded:", data)
      setFiles(data || [])
    } catch (error: any) {
      console.error("Error loading files:", error)
      alert(`Error al cargar archivos: ${error.message || "Error desconocido"}`)
    } finally {
      setLoading(false)
    }
  }

  const loadFolders = async () => {
    try {
      const { data, error } = await supabase
        .from("folders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error loading folders:", error)
        throw error
      }

      setFolders(data || [])
    } catch (error: any) {
      console.error("Error loading folders:", error)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      // Create a unique filename with user ID prefix
      const fileExt = file.name.split(".").pop()
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`

      console.log("Uploading file:", fileName)

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("user-files")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        })

      if (uploadError) {
        console.error("Upload error:", uploadError)
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      console.log("Upload successful:", uploadData)

      // Save file metadata to database
      const { data: dbData, error: dbError } = await supabase
        .from("files")
        .insert({
          user_id: user.id,
          name: fileName,
          original_name: file.name,
          file_type: file.type || "application/octet-stream",
          file_size: file.size,
          storage_path: fileName,
        })
        .select()

      if (dbError) {
        console.error("Database error details:", dbError)
        // If database insert fails, clean up the uploaded file
        await supabase.storage.from("user-files").remove([fileName])
        throw new Error(`Database error: ${dbError.message || JSON.stringify(dbError)}`)
      }

      console.log("Database insert successful:", dbData)

      // Reload files to show the new upload
      await loadFiles()

      // Reset the file input
      event.target.value = ""
    } catch (error: any) {
      console.error("Error uploading file:", error)
      alert(`Error al subir el archivo: ${error.message || "Error desconocido"}`)
    } finally {
      setUploading(false)
    }
  }

  const handleDownloadFile = async (file: FileItem) => {
    try {
      const { data, error } = await supabase.storage.from("user-files").download(file.storage_path)

      if (error) throw error

      // Create blob URL and trigger download
      const url = URL.createObjectURL(data)
      const a = document.createElement("a")
      a.href = url
      a.download = file.original_name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error: any) {
      console.error("Error downloading file:", error)
      alert(`Error al descargar el archivo: ${error.message}`)
    }
  }

  const handleDeleteFile = async (file: FileItem) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar "${file.original_name}"?`)) {
      return
    }

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage.from("user-files").remove([file.storage_path])

      if (storageError) throw storageError

      // Delete from database
      const { error: dbError } = await supabase.from("files").delete().eq("id", file.id)

      if (dbError) throw dbError

      // Reload files
      await loadFiles()
    } catch (error: any) {
      console.error("Error deleting file:", error)
      alert(`Error al eliminar el archivo: ${error.message}`)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <div className="w-64 border-r border-gray-700 bg-gray-800">
        <div className="p-4">
          <h1 className="text-xl font-bold text-white">Mi Almacén</h1>
        </div>
        <nav className="space-y-1 px-2">
          <NavItem href="#" icon={<LayoutGrid className="h-4 w-4" />} active>
            Todos los archivos
          </NavItem>
          <div className="py-3">
            <div className="px-3 text-xs font-medium uppercase text-gray-400">Carpetas</div>
            <div className="mt-2">
              {folders.map((folder) => (
                <FolderItemComponent key={folder.id} folder={folder} />
              ))}
            </div>
          </div>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 bg-gray-900">
        <header className="flex items-center justify-between border-b border-gray-700 px-6 py-4 bg-gray-800">
          <div className="w-96">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                type="search"
                placeholder="Buscar archivos..."
                className="pl-9 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-300">{user.email}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-gray-300 hover:text-white hover:bg-gray-700"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="p-6">
          <div className="mb-6 flex items-center gap-4">
            <label htmlFor="file-upload">
              <Button className="gap-2 bg-blue-600 hover:bg-blue-700" disabled={uploading} asChild>
                <span>
                  <Upload className="h-4 w-4" />
                  {uploading ? "Subiendo..." : "Subir archivo"}
                </span>
              </Button>
            </label>
            <input id="file-upload" type="file" onChange={handleFileUpload} className="hidden" />
          </div>

          <div className="mb-6">
            <Tabs defaultValue="recent" className="w-full">
              <TabsList className="bg-gray-800 border-gray-700">
                <TabsTrigger
                  value="recent"
                  className="data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-300"
                >
                  Recientes
                </TabsTrigger>
                <TabsTrigger
                  value="all"
                  className="data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-300"
                >
                  Todos
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-300">Cargando archivos...</div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No tienes archivos aún. ¡Sube tu primer archivo!</div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {files.map((file) => (
                <FileCard key={file.id} file={file} onDelete={handleDeleteFile} onDownload={handleDownloadFile} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
