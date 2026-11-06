// import type { Document } from "../../interfaces/Document";
// import "../../styles/pdf/pdf-viewer.css";

// interface DocumentListProps {
//   documents: Document[];
//   selectedDocumentId?: number;
//   onSelectDocument: (document: Document) => void;
//   loading?: boolean;
// }

// export const DocumentList = ({
//   documents,
//   selectedDocumentId,
//   onSelectDocument,
//   loading = false,
// }: DocumentListProps) => {
//   const formatDate = (date: Date | string) => {
//     const dateObj = typeof date === "string" ? new Date(date) : date;
//     return dateObj.toLocaleDateString("es-ES", {
//       year: "numeric",
//       month: "short",
//       day: "numeric",
//     });
//   };

//   const formatFileSize = (bytes?: number) => {
//     if (!bytes) return "";
//     if (bytes < 1024) return bytes + " B";
//     if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
//     return (bytes / (1024 * 1024)).toFixed(2) + " MB";
//   };

//   return (
//     <div className="document-list-container">
//       <h4 className="document-list-title">Documentos del Expediente</h4>

//       {loading && (
//         <div className="document-list-loading">Cargando documentos...</div>
//       )}

//       {!loading && documents.length === 0 && (
//         <div className="document-list-empty">No hay documentos disponibles</div>
//       )}

//       {!loading && documents.length > 0 && (
//         <div className="document-list">
//           {documents.map((doc) => (
//             <div
//               key={doc.documentId}
//               className={`document-card ${selectedDocumentId === doc.documentId ? "selected" : ""}`}
//             >
//               <div className="document-card-info">
//                 <h5 className="document-name">{doc.documentName}</h5>
//                 <div className="document-meta">
//                   <span className="document-type">{doc.documentType}</span>
//                   <span className="document-date">
//                     {formatDate(doc.uploadedAt)}
//                   </span>
//                   {doc.fileSize && (
//                     <span className="document-size">
//                       {formatFileSize(doc.fileSize)}
//                     </span>
//                   )}
//                 </div>
//               </div>
//               <div className="document-actions">
//                 <button
//                   type="button"
//                   className="btn-view"
//                   onClick={() => onSelectDocument(doc)}
//                   title="Ver documento"
//                 >
//                   Ver
//                 </button>
//                 {/* {doc.fileUrl && (
//                   <a
//                     href={doc.fileUrl}
//                     download
//                     className="btn-download"
//                     title="Descargar documento"
//                   >
//                     ⬇
//                   </a>
//                 )} */}
//               </div>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// };
