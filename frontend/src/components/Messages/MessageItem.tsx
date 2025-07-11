import React, { useState } from 'react';
import { Message, Chat, User } from '../../types';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { 
  Check, 
  CheckCheck, 
  Edit, 
  Reply, 
  MoreVertical,
  Copy,
  Forward,
  Trash2,
  Download,
  ExternalLink
} from 'lucide-react';

interface MessageItemProps {
  message: Message;
  currentUser?: User;
  isOwn: boolean;
  showAvatar: boolean;
  chat: Chat;
  onReply?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({
  message,
  currentUser,
  isOwn,
  showAvatar,
  chat,
  onReply,
  onEdit,
  onDelete
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  const getMessageStatusIcon = () => {
    if (!isOwn) return null;

    if (message.read) {
      return <CheckCheck className="w-4 h-4 text-blue-500" />;
    } else if (message.delivered) {
      return <CheckCheck className="w-4 h-4 text-gray-400" />;
    } else {
      return <Check className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleTimeString('tr-TR', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content);
    setShowMenu(false);
  };

  const handleReplyToMessage = () => {
    onReply?.(message);
    setShowMenu(false);
  };

  const handleEditMessage = () => {
    onEdit?.(message);
    setShowMenu(false);
  };

  const handleDeleteMessage = () => {
    onDelete?.(message.id);
    setShowMenu(false);
  };

  const renderMessageContent = () => {
    switch (message.type) {
      case 'TEXT':
        return (
          <div className="break-words">
            {message.content.split('\n').map((line, index) => (
              <React.Fragment key={index}>
                {line}
                {index < message.content.split('\n').length - 1 && <br />}
              </React.Fragment>
            ))}
          </div>
        );
      
      case 'IMAGE':
        return (
          <div className="space-y-2">
            <img
              src={message.content}
              alt="Shared image"
              className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(message.content, '_blank')}
            />
          </div>
        );
      
      case 'FILE':
        return (
          <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {message.content}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Dosya
              </p>
            </div>
            <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        );
      
      default:
        return <div>{message.content}</div>;
    }
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`}>
      <div className={`flex ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end space-x-2 max-w-xs lg:max-w-md`}>
        {/* Avatar */}
        {!isOwn && (
          <div className="flex-shrink-0">
            {showAvatar ? (
              <img
                src={message.sender.avatar || '/default-avatar.png'}
                alt={message.sender.firstName}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8" />
            )}
          </div>
        )}

        {/* Message Bubble */}
        <div className="relative">
          {/* Reply indicator */}
          {message.replyTo && message.replyToMessage && (
            <div className={`mb-1 p-2 rounded-lg text-xs border-l-2 ${
              isOwn 
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 text-blue-800 dark:text-blue-300'
                : 'bg-gray-50 dark:bg-gray-700 border-gray-400 text-gray-700 dark:text-gray-300'
            }`}>
              <p className="font-medium">
                {message.replyToMessage.sender.firstName}
              </p>
              <p className="truncate">
                {message.replyToMessage.content}
              </p>
            </div>
          )}

          {/* Main Message */}
          <div 
            className={`relative px-4 py-2 rounded-2xl ${
              isOwn
                ? 'bg-blue-500 text-white'
                : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600'
            }`}
            onMouseEnter={() => setShowMenu(true)}
            onMouseLeave={() => setShowMenu(false)}
          >
            {/* Sender name for group chats */}
            {!isOwn && chat.type === 'GROUP' && showAvatar && (
              <p className="text-xs font-medium mb-1 opacity-70">
                {message.sender.firstName}
              </p>
            )}

            {/* Message Content */}
            <div className="text-sm">
              {renderMessageContent()}
            </div>

            {/* Message metadata */}
            <div className={`flex items-center justify-end space-x-1 mt-1 text-xs ${
              isOwn ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
            }`}>
              {/* Edit indicator */}
              {message.edited && (
                <span className="opacity-70">düzenlendi</span>
              )}
              
              {/* Time */}
              <span className="opacity-70">
                {formatTime(message.createdAt)}
              </span>
              
              {/* Status for own messages */}
              {getMessageStatusIcon()}
            </div>

            {/* Quick actions menu */}
            {showMenu && (
              <div className={`absolute ${isOwn ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'} top-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 p-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity`}>
                <button
                  onClick={handleReplyToMessage}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                  title="Yanıtla"
                >
                  <Reply className="w-4 h-4" />
                </button>
                
                <button
                  onClick={handleCopyMessage}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                  title="Kopyala"
                >
                  <Copy className="w-4 h-4" />
                </button>
                
                {isOwn && (
                  <button
                    onClick={handleEditMessage}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                    title="Düzenle"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}
                
                {isOwn && (
                  <button
                    onClick={handleDeleteMessage}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-red-600 dark:text-red-400"
                    title="Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageItem;