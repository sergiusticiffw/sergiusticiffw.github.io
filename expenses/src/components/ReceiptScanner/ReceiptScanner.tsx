import { useState, useRef, FC } from 'react';
import { FiCamera, FiUpload, FiX, FiCheck, FiEdit2 } from 'react-icons/fi';
import { useLocalization } from '@context/localization';
import { processReceipt, ExtractedReceiptData } from '@utils/receiptOCR';
import { imageToBase64, compressImage } from '@utils/imageUtils';
import { useNotification } from '@context/notification';
import { logger } from '@utils/logger';
import './ReceiptScanner.scss';

interface ReceiptScannerProps {
  onDataExtracted: (data: ExtractedReceiptData) => void;
  onClose?: () => void;
}

const ReceiptScanner: FC<ReceiptScannerProps> = ({
  onDataExtracted,
  onClose,
}) => {
  const { t } = useLocalization();
  const showNotification = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedData, setExtractedData] =
    useState<ExtractedReceiptData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<ExtractedReceiptData | null>(
    null
  );

  const handleFileSelect = async (file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showNotification('Please select an image file', 'error');
      return;
    }

    try {
      // Show preview
      const base64 = await imageToBase64(file);
      setImagePreview(base64);

      // Compress and enhance image for OCR
      setIsProcessing(true);
      setProgress(0);
      const compressed = await compressImage(base64, 2400, 2400, 0.9, true); // Higher quality, enhanced for OCR
      setProgress(10);

      // Process with OCR - pass progress callback
      // processReceipt already maps OCR progress to 0-90%, then adds 10% for parsing
      // So we just need to add 10% for the compression phase
      const processed = await processReceipt(compressed, (ocrProgress) => {
        // OCR progress is already 0-100% from processReceipt (which maps to 0-90% internally)
        // Add 10% for compression phase
        setProgress(10 + Math.round((ocrProgress / 100) * 90));
      });
      setProgress(100);

      // Log extracted data for debugging
      logger.log('Extracted receipt data:', processed);

      setExtractedData(processed);
      setEditedData(processed);
      setIsProcessing(false);

      showNotification('Receipt processed successfully', 'success');
    } catch (error) {
      logger.error('Error processing receipt:', error);
      showNotification('Failed to process receipt. Please try again.', 'error');
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleUseData = () => {
    if (editedData) {
      onDataExtracted(editedData);
      if (onClose) {
        onClose();
      }
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editedData) {
      setExtractedData(editedData);
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedData(extractedData);
    setIsEditing(false);
  };

  return (
    <div className="receipt-scanner">
      <div className="receipt-scanner__header">
        <h3>{t('receipt.scanTitle') || 'Scan Receipt'}</h3>
        {/* Close button removed - Modal handles closing */}
      </div>

      <div className="receipt-scanner__content">
        {!imagePreview && (
          <div className="receipt-scanner__upload-area">
            <div className="receipt-scanner__upload-buttons">
              <button
                className="receipt-scanner__button receipt-scanner__button--camera"
                onClick={handleCameraClick}
                disabled={isProcessing}
              >
                <FiCamera />
                <span>{t('receipt.takePhoto') || 'Take Photo'}</span>
              </button>
              <button
                className="receipt-scanner__button receipt-scanner__button--upload"
                onClick={handleUploadClick}
                disabled={isProcessing}
              >
                <FiUpload />
                <span>{t('receipt.uploadImage') || 'Upload Image'}</span>
              </button>
            </div>
            <p className="receipt-scanner__hint">
              {t('receipt.hint') ||
                'Take a photo or upload an image of your receipt'}
            </p>
          </div>
        )}

        {imagePreview && (
          <div className="receipt-scanner__preview">
            <div className="receipt-scanner__image-container">
              <img src={imagePreview} alt="Receipt preview" />
              {isProcessing && (
                <div className="receipt-scanner__processing">
                  <div className="receipt-scanner__spinner"></div>
                  <p>Processing... {progress}%</p>
                </div>
              )}
            </div>

            {extractedData && !isProcessing && (
              <div className="receipt-scanner__extracted-data">
                <div className="receipt-scanner__data-header">
                  <h4>{t('receipt.extractedData') || 'Extracted Data'}</h4>
                  {!isEditing && (
                    <button
                      className="receipt-scanner__edit-button"
                      onClick={handleEdit}
                    >
                      <FiEdit2 />
                      {t('common.edit') || 'Edit'}
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="receipt-scanner__edit-form">
                    <div className="receipt-scanner__field">
                      <label>{t('receipt.amount') || 'Amount'}</label>
                      <input
                        type="text"
                        value={editedData?.amount || ''}
                        onChange={(e) =>
                          setEditedData({
                            ...editedData!,
                            amount: e.target.value,
                          })
                        }
                        placeholder="0.00"
                      />
                    </div>
                    <div className="receipt-scanner__field">
                      <label>{t('receipt.date') || 'Date'}</label>
                      <input
                        type="date"
                        value={editedData?.date || ''}
                        onChange={(e) =>
                          setEditedData({
                            ...editedData!,
                            date: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="receipt-scanner__field">
                      <label>{t('receipt.merchant') || 'Merchant'}</label>
                      <input
                        type="text"
                        value={editedData?.merchant || ''}
                        onChange={(e) =>
                          setEditedData({
                            ...editedData!,
                            merchant: e.target.value,
                          })
                        }
                        placeholder="Store name"
                      />
                    </div>
                    <div className="receipt-scanner__field">
                      <label>{t('receipt.description') || 'Description'}</label>
                      <textarea
                        value={editedData?.description || ''}
                        onChange={(e) =>
                          setEditedData({
                            ...editedData!,
                            description: e.target.value,
                          })
                        }
                        placeholder="Description"
                        rows={3}
                      />
                    </div>
                    <div className="receipt-scanner__edit-actions">
                      <button
                        className="receipt-scanner__button receipt-scanner__button--save"
                        onClick={handleSaveEdit}
                      >
                        <FiCheck />
                        {t('common.save') || 'Save'}
                      </button>
                      <button
                        className="receipt-scanner__button receipt-scanner__button--cancel"
                        onClick={handleCancelEdit}
                      >
                        <FiX />
                        {t('common.cancel') || 'Cancel'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="receipt-scanner__data-display">
                    {extractedData.amount && (
                      <div className="receipt-scanner__data-item">
                        <span className="receipt-scanner__label">
                          {t('receipt.amount') || 'Amount'}:
                        </span>
                        <span className="receipt-scanner__value">
                          {extractedData.amount}
                        </span>
                      </div>
                    )}
                    {extractedData.date && (
                      <div className="receipt-scanner__data-item">
                        <span className="receipt-scanner__label">
                          {t('receipt.date') || 'Date'}:
                        </span>
                        <span className="receipt-scanner__value">
                          {extractedData.date}
                        </span>
                      </div>
                    )}
                    {extractedData.merchant && (
                      <div className="receipt-scanner__data-item">
                        <span className="receipt-scanner__label">
                          {t('receipt.merchant') || 'Merchant'}:
                        </span>
                        <span className="receipt-scanner__value">
                          {extractedData.merchant}
                        </span>
                      </div>
                    )}
                    {extractedData.description && (
                      <div className="receipt-scanner__data-item">
                        <span className="receipt-scanner__label">
                          {t('receipt.description') || 'Description'}:
                        </span>
                        <span className="receipt-scanner__value">
                          {extractedData.description}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {extractedData && !isProcessing && (
              <div className="receipt-scanner__actions">
                <button
                  className="receipt-scanner__button receipt-scanner__button--primary"
                  onClick={handleUseData}
                >
                  <FiCheck />
                  {t('receipt.useData') || 'Use This Data'}
                </button>
                <button
                  className="receipt-scanner__button receipt-scanner__button--secondary"
                  onClick={() => {
                    setImagePreview(null);
                    setExtractedData(null);
                    setEditedData(null);
                    setIsEditing(false);
                  }}
                >
                  <FiX />
                  {t('receipt.scanAnother') || 'Scan Another'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default ReceiptScanner;
