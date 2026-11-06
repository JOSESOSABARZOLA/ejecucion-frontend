import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import type { FieldInputProps, FormikErrors, FormikTouched } from "formik";

interface FileUploaderProps {
  field?: FieldInputProps<File | undefined>;
  form?: {
    setFieldValue: (field: string, value: any) => void;
    touched: FormikTouched<any>;
    errors: FormikErrors<any>;
  };
  error?: string | false;
}

const FileUploader: React.FC<FileUploaderProps> = ({ field, form, error }) => {
  const [isDocumentAccepted, setIsDocumentAccepted] = useState<boolean | null>(
    null,
  );

  // Obtener el archivo seleccionado del campo de Formik
  const selectedFile = field?.value;

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];

        // Actualizar el valor en Formik
        if (form && field?.name) {
          form.setFieldValue(field.name, file);
        }

        setIsDocumentAccepted(true);
        console.log("Archivo seleccionado:", file);
      }
    },
    [field?.name, form],
  );

  const onDropRejected = useCallback((fileRejections: any[]) => {
    setIsDocumentAccepted(false);
    console.log("Archivos rechazados:", fileRejections);
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      onDropRejected,
      accept: { "application/pdf": [".pdf"] },
      multiple: false,
    });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors
          ${isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:bg-gray-50"}
          ${isDocumentAccepted === false || error ? "border-red-500 bg-red-50" : ""}`}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center">
          {isDocumentAccepted === null && !selectedFile ? (
            <p className="text-gray-600 font-light">
              Arrastra y suelta un archivo aquí, o{" "}
              <span className="text-blue-500 underline">
                haz clic para buscar
              </span>
            </p>
          ) : null}

          {(isDocumentAccepted === true || selectedFile) && (
            <div className="text-center">
              <p className="text-green-600 font-medium">✓ Archivo aceptado</p>
              {selectedFile && (
                <p className="text-sm text-gray-600 mt-2">
                  {selectedFile.name}
                </p>
              )}
            </div>
          )}

          {isDocumentAccepted === false && (
            <p className="text-red-600 mt-2">
              Por favor ingrese un documento válido
            </p>
          )}

          {isDragActive && isDragReject && (
            <p className="text-red-600 mt-2">
              Archivo no permitido. Solo se aceptan PDFs.
            </p>
          )}

          {isDragActive && !isDragReject && (
            <p className="text-blue-600 font-medium">¡Suéltalo ahora!</p>
          )}

          <p className="text-xs text-gray-400 mt-2">
            Solo archivos PDF (máx. 10MB)
          </p>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
};

export default FileUploader;
