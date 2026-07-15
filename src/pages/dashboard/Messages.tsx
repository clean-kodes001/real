import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { useLocation } from "wouter";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatAPI, ApiError } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";
import { getInitials, formatRelativeTime } from "@/lib/utils";

interface Conversation {
  uuid: string;
  other_uuid?: string;
  other_user?: { 
    name?: string; 
    email?: string; 
    photo?: string;
    uuid?: string;
  };
  last_message?: string;
  unread_count?: number;
  last_message_at?: string;
}

interface Message {
  uuid: string;
  sender_uuid?: string;
  receiver_uuid?: string;
  message_type?: string;
  message?: string;
  file_url?: string | null;
  file_name?: string | null;
  is_read?: number;
  created_at?: string;
}

export default function Messages() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [deletingMessage, setDeletingMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [conversationUuid, setConversationUuid] = useState<string | null>(null);
  const [isProcessingContact, setIsProcessingContact] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const contactProcessed = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('user');
    const userName = params.get('name') || 'User';
    
    if (userId && !contactProcessed.current) {
      contactProcessed.current = true;
      handleContactUserDirect(userId, userName);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    
    pollingInterval.current = setInterval(() => {
      if (selectedConv && selectedConv.uuid !== 'new' && selectedConv.uuid !== 'loading') {
        fetchMessages(selectedConv.uuid, true);
      }
      fetchConversations();
    }, 5000);
    
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedConv && selectedConv.uuid !== 'new' && selectedConv.uuid !== 'loading') {
      fetchMessages(selectedConv.uuid);
      markAsRead(selectedConv.uuid);
    }
  }, [selectedConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleContactUserDirect(userId: string, userName: string) {
    if (isProcessingContact) return;
    
    setIsProcessingContact(true);
    setLoadingMsgs(true);
    
    try {
      const loadingConv: Conversation = {
        uuid: 'loading',
        other_uuid: userId,
        other_user: {
          name: userName,
          uuid: userId,
        },
        last_message: 'Loading...',
        unread_count: 0,
      };
      setSelectedConv(loadingConv);
      setMessages([]);

      const response = await ChatAPI.getConversations();
      const conversationsData = response?.conversations || [];
      
      const existingConv = conversationsData.find((conv: any) => 
        conv.other_uuid === userId || 
        (conv.participants && conv.participants.includes(userId))
      );
      
      if (existingConv) {
        setSelectedConv(existingConv);
        setConversationUuid(existingConv.uuid);
        await fetchMessages(existingConv.uuid);
        await markAsRead(existingConv.uuid);
        clearContactFromUrl();
        setIsProcessingContact(false);
        setLoadingMsgs(false);
        return;
      }
      
      try {
        const createResponse = await ChatAPI.createConversation(userId);
        const newConvUuid = createResponse?.data?.uuid || createResponse?.uuid;
        
        if (newConvUuid) {
          await fetchConversations();
          const updatedConversations = await ChatAPI.getConversations();
          const newConv = updatedConversations?.conversations?.find((c: any) => 
            c.other_uuid === userId || 
            (c.participants && c.participants.includes(userId))
          );
          
          if (newConv) {
            setSelectedConv(newConv);
            setConversationUuid(newConv.uuid);
            setMessages([]);
            toast.success(`Started chat with ${userName}`);
          } else {
            const tempConv: Conversation = {
              uuid: 'new',
              other_uuid: userId,
              other_user: {
                name: userName,
                uuid: userId,
              },
              last_message: 'Send a message to start chatting',
              unread_count: 0,
            };
            setSelectedConv(tempConv);
            setConversationUuid(null);
            setMessages([]);
          }
        } else {
          const tempConv: Conversation = {
            uuid: 'new',
            other_uuid: userId,
            other_user: {
              name: userName,
              uuid: userId,
            },
            last_message: 'Send a message to start chatting',
            unread_count: 0,
          };
          setSelectedConv(tempConv);
          setConversationUuid(null);
          setMessages([]);
        }
      } catch (createError) {
        console.error("Failed to create conversation:", createError);
        const tempConv: Conversation = {
          uuid: 'new',
          other_uuid: userId,
          other_user: {
            name: userName,
            uuid: userId,
          },
          last_message: 'Send a message to start chatting',
          unread_count: 0,
        };
        setSelectedConv(tempConv);
        setConversationUuid(null);
        setMessages([]);
        toast.info(`Start chatting with ${userName}`);
      }
      
      clearContactFromUrl();
      
    } catch (error) {
      console.error("Failed to handle contact:", error);
      toast.error("Failed to start conversation");
      setSelectedConv(null);
    } finally {
      setIsProcessingContact(false);
      setLoadingMsgs(false);
    }
  }

  function clearContactFromUrl() {
    if (window.history.replaceState) {
      window.history.replaceState({}, '', '/dashboard/messages');
    }
  }

  async function fetchConversations() {
    setLoadingConvs(true);
    try {
      const response = await ChatAPI.getConversations();
      const convs = response?.conversations || response || [];
      setConversations(Array.isArray(convs) ? convs : []);
      setError(null);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
        setError(error.message);
      } else {
        toast.error("Failed to load conversations");
        setError("Failed to load conversations");
      }
    } finally {
      setLoadingConvs(false);
    }
  }

  async function fetchMessages(conversationUuid: string, silent: boolean = false) {
    if (!conversationUuid || conversationUuid === 'new' || conversationUuid === 'loading') return;
    
    setLoadingMsgs(true);
    try {
      const response = await ChatAPI.getMessages(conversationUuid);
      const msgs = response?.messages || response || [];
      setMessages(Array.isArray(msgs) ? msgs : []);
      
      setConversations(prev => prev.map(conv => 
        conv.uuid === conversationUuid 
          ? { ...conv, unread_count: 0 }
          : conv
      ));
    } catch (error) {
      if (!silent) {
        if (error instanceof ApiError) {
          toast.error(error.getDisplayMessage());
        } else {
          toast.error("Failed to load messages");
        }
      }
    } finally {
      setLoadingMsgs(false);
    }
  }

  async function markAsRead(conversationUuid: string) {
    if (!conversationUuid || conversationUuid === 'new' || conversationUuid === 'loading') return;
    try {
      await ChatAPI.markAsRead(conversationUuid);
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() && !selectedFile) return;
    
    let receiverUuid = selectedConv?.other_uuid;
    
    if (!receiverUuid) {
      toast.error("No recipient selected");
      return;
    }

    setSending(true);
    try {
      let imageBase64: string | undefined;
      
      if (selectedFile) {
        if (selectedFile.size > 5 * 1024 * 1024) {
          toast.error("File is too large. Maximum size is 5MB");
          setSending(false);
          return;
        }
        imageBase64 = await fileToBase64(selectedFile);
      }

      const payload: any = {
        receiver_uuid: receiverUuid,
        message: newMessage.trim() || "📎 Image",
        message_type: imageBase64 ? 'image' : 'text'
      };
      
      if (selectedConv?.uuid && selectedConv.uuid !== 'new' && selectedConv.uuid !== 'loading') {
        payload.conversation_uuid = selectedConv.uuid;
      }
      
      if (imageBase64) {
        payload.file_url = imageBase64;
        payload.file_name = selectedFile?.name;
      }

      const response = await ChatAPI.sendMessage(payload);

      if (selectedConv?.uuid === 'new') {
        await fetchConversations();
        const newConv = conversations.find(c => c.other_uuid === receiverUuid);
        if (newConv) {
          setSelectedConv(newConv);
          setConversationUuid(newConv.uuid);
        }
      }

      const newMsg: Message = {
        uuid: response?.uuid || Date.now().toString(),
        sender_uuid: user?.uuid,
        receiver_uuid: receiverUuid,
        message_type: imageBase64 ? 'image' : 'text',
        message: newMessage.trim() || "📎 Image",
        file_url: response?.file_url || null,
        file_name: selectedFile?.name || null,
        is_read: 0,
        created_at: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, newMsg]);
      setNewMessage("");
      setSelectedFile(null);
      setFilePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      
      setConversations(prev => prev.map(conv => 
        conv.uuid === selectedConv?.uuid || conv.other_uuid === receiverUuid
          ? { 
              ...conv, 
              last_message: newMessage.trim() || "📎 Image",
              last_message_at: new Date().toISOString()
            }
          : conv
      ));

      setTimeout(fetchConversations, 1000);

    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to send message");
      }
    } finally {
      setSending(false);
    }
  }

  async function handleDeleteMessage(messageUuid: string) {
    if (!messageUuid) return;
    
    setDeletingMessage(messageUuid);
    try {
      await ChatAPI.deleteMessage(messageUuid);
      toast.success("Message deleted");
      setMessages(prev => prev.filter(msg => msg.uuid !== messageUuid));
      setShowDeleteConfirm(null);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to delete message");
      }
    } finally {
      setDeletingMessage(null);
    }
  }

  async function handleTypingStatus(isTyping: boolean) {
    if (!selectedConv || selectedConv.uuid === 'new' || selectedConv.uuid === 'loading') return;
    try {
      await ChatAPI.typing(selectedConv.uuid, isTyping);
    } catch (error) {
      console.error("Typing status update failed:", error);
    }
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  }

  function handleTyping(e: React.ChangeEvent<HTMLInputElement>) {
    setNewMessage(e.target.value);
    if (!typing && selectedConv && selectedConv.uuid !== 'new' && selectedConv.uuid !== 'loading') {
      setTyping(true);
      handleTypingStatus(true);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false);
      if (selectedConv && selectedConv.uuid !== 'new' && selectedConv.uuid !== 'loading') {
        handleTypingStatus(false);
      }
    }, 2000);
  }

  function formatMessageTime(date: string): string {
    return formatRelativeTime(date);
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="h-[calc(100vh-12rem)] flex rounded-2xl bg-muted/30 overflow-hidden">
          {/* Conversations List */}
          <div className={`w-full md:w-80 shrink-0 flex flex-col ${selectedConv && selectedConv.uuid !== 'loading' ? "hidden md:flex" : "flex"}`}>
            <div className="px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Messages</h2>
              <button
                onClick={fetchConversations}
                className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Icon icon="solar:refresh-bold" className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {loadingConvs ? (
                <div className="p-3 space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : error && conversations.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                    <Icon icon="solar:danger-triangle-bold" className="w-6 h-6 text-red-500" />
                  </div>
                  <p className="text-sm text-muted-foreground">{error}</p>
                  <button
                    onClick={fetchConversations}
                    className="mt-4 px-6 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 transition-opacity"
                  >
                    Try Again
                  </button>
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <Icon icon="solar:chat-round-bold" className="w-6 h-6 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm text-muted-foreground">No conversations</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Start chatting with a buyer, seller, or lawyer
                  </p>
                </div>
              ) : (
                conversations.map(conv => (
                  <button 
                    key={conv.uuid} 
                    onClick={() => {
                      setSelectedConv(conv);
                      setConversationUuid(conv.uuid);
                      if (conv.uuid !== 'new') {
                        markAsRead(conv.uuid);
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left ${
                      conv.uuid === selectedConv?.uuid ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium shrink-0">
                      {conv.other_user?.photo
                        ? <img src={conv.other_user.photo} alt="" className="w-full h-full rounded-full object-cover" />
                        : getInitials(conv.other_user?.name ?? "?")}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm truncate">
                          {conv.other_user?.name ?? "Unknown"}
                        </p>
                        {conv.last_message_at && (
                          <span className="text-xs text-muted-foreground/60 shrink-0 ml-2">
                            {formatMessageTime(conv.last_message_at)}
                          </span>
                        )}
                      </div>
                      {conv.last_message && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {conv.last_message}
                        </p>
                      )}
                    </div>
                    
                    {(conv.unread_count ?? 0) > 0 && (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] text-primary-foreground font-medium shrink-0">
                        {conv.unread_count}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat Panel */}
          <div className={`flex-1 flex flex-col bg-background/50 ${!selectedConv || selectedConv.uuid === 'loading' ? "hidden md:flex" : "flex"}`}>
            {selectedConv && selectedConv.uuid !== 'loading' ? (
              <>
                {/* Header */}
                <div className="px-4 py-3 flex items-center gap-3 shrink-0 border-b border-border/30">
                  <button 
                    onClick={() => {
                      setSelectedConv(null);
                      setMessages([]);
                      setConversationUuid(null);
                      clearContactFromUrl();
                    }} 
                    className="md:hidden p-1 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <Icon icon="solar:arrow-left-bold" className="w-5 h-5" />
                  </button>
                  
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium">
                    {getInitials(selectedConv.other_user?.name ?? "?")}
                  </div>
                  
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {selectedConv.other_user?.name ?? "Unknown"}
                    </p>
                    {isOtherTyping && (
                      <p className="text-xs text-primary">Typing...</p>
                    )}
                    {selectedConv.uuid === 'new' && (
                      <p className="text-xs text-muted-foreground">New conversation</p>
                    )}
                  </div>
                </div>

                {/* New Conversation Info */}
                {selectedConv.uuid === 'new' && (
                  <div className="px-4 py-2 bg-primary/5 text-center">
                    <p className="text-xs text-muted-foreground">
                      Send a message to start chatting with <span className="font-medium text-foreground">{selectedConv.other_user?.name}</span>
                    </p>
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {selectedConv.uuid === 'new' && messages.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                        <Icon icon="solar:chat-round-bold" className="w-6 h-6 text-muted-foreground/40" />
                      </div>
                      <p className="text-sm text-muted-foreground">No messages yet</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Send a message to start the conversation
                      </p>
                    </div>
                  ) : loadingMsgs ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className={`flex ${i % 2 === 0 ? "" : "justify-end"}`}>
                          <Skeleton className={`h-10 ${i % 2 === 0 ? "w-48" : "w-32"} rounded-2xl`} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    messages.map((msg, index) => {
                      const isMe = msg.sender_uuid === user?.uuid;
                      const showDate = index === 0 || 
                        (messages[index - 1]?.created_at && 
                         new Date(msg.created_at || '').getDate() !== new Date(messages[index - 1].created_at || '').getDate());
                      
                      return (
                        <div key={msg.uuid || index}>
                          {showDate && msg.created_at && (
                            <div className="text-center my-4">
                              <span className="text-[10px] text-muted-foreground/60 bg-muted/50 px-3 py-1 rounded-full">
                                {new Date(msg.created_at).toLocaleDateString('en-US', { 
                                  weekday: 'long', 
                                  month: 'short', 
                                  day: 'numeric' 
                                })}
                              </span>
                            </div>
                          )}
                          <motion.div 
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex ${isMe ? "justify-end" : ""}`}
                          >
                            <div className={`relative group max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                              isMe 
                                ? "bg-primary text-primary-foreground" 
                                : "bg-muted/50 text-foreground"
                            }`}>
                              {msg.message_type === 'image' && msg.file_url && (
                                <div className="mb-2">
                                  <img 
                                    src={msg.file_url} 
                                    alt="Image" 
                                    className="max-w-full rounded-lg max-h-48 object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                </div>
                              )}
                              {msg.message && (
                                <p className="break-words">{msg.message}</p>
                              )}
                              {msg.created_at && (
                                <p className={`text-[10px] mt-1 ${
                                  isMe ? "text-primary-foreground/60" : "text-muted-foreground/60"
                                }`}>
                                  {formatMessageTime(msg.created_at)}
                                </p>
                              )}
                              
                              {isMe && msg.uuid && (
                                <button
                                  onClick={() => setShowDeleteConfirm(msg.uuid!)}
                                  className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all"
                                >
                                  <Icon icon="solar:trash-bin-bold" className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </motion.div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* File Preview */}
                {filePreview && (
                  <div className="px-4 pb-2">
                    <div className="relative inline-block p-2 bg-muted/30 rounded-xl">
                      {selectedFile?.type.startsWith('image/') ? (
                        <img src={filePreview} alt="Preview" className="max-h-20 rounded-lg" />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Icon icon="solar:document-bold" className="w-6 h-6 text-muted-foreground" />
                          <span className="text-xs">{selectedFile?.name}</span>
                        </div>
                      )}
                      <button
                        onClick={() => {
                          setSelectedFile(null);
                          setFilePreview(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                      >
                        <Icon icon="solar:close-bold" className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Input */}
                <form onSubmit={handleSend} className="p-3 border-t border-border/30 flex gap-2 shrink-0">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="image/*"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-xl hover:bg-muted/30 transition-colors"
                  >
                    <Icon icon="solar:gallery-bold" className="w-5 h-5 text-muted-foreground" />
                  </button>
                  
                  <input
                    value={newMessage}
                    onChange={handleTyping}
                    placeholder={selectedConv.other_user?.name ? `Message ${selectedConv.other_user.name}...` : "Type a message..."}
                    className="flex-1 px-4 py-2 rounded-xl bg-muted/30 focus:bg-muted/50 transition-colors text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                  
                  <button 
                    type="submit" 
                    disabled={sending || (!newMessage.trim() && !selectedFile)}
                    className="p-2 bg-foreground text-background rounded-xl hover:opacity-80 disabled:opacity-30 transition-opacity"
                  >
                    {sending ? (
                      <Icon icon="solar:refresh-bold" className="w-5 h-5 animate-spin" />
                    ) : (
                      <Icon icon="solar:plain-bold" className="w-5 h-5" />
                    )}
                  </button>
                </form>

                {/* Delete Confirmation Modal */}
                <AnimatePresence>
                  {showDeleteConfirm && (
                    <>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
                        onClick={() => setShowDeleteConfirm(null)}
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-sm mx-auto z-50"
                      >
                        <div className="bg-background rounded-2xl p-6">
                          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                            <Icon icon="solar:trash-bin-bold" className="w-6 h-6 text-red-500" />
                          </div>
                          <h3 className="text-lg font-light text-center">Delete Message</h3>
                          <p className="text-sm text-muted-foreground text-center mt-1">
                            This action cannot be undone.
                          </p>
                          <div className="flex gap-3 mt-6">
                            <button
                              onClick={() => setShowDeleteConfirm(null)}
                              className="flex-1 py-2.5 rounded-xl text-sm font-medium hover:bg-muted/50 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDeleteMessage(showDeleteConfirm)}
                              disabled={deletingMessage === showDeleteConfirm}
                              className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
                            >
                              {deletingMessage === showDeleteConfirm && (
                                <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />
                              )}
                              Delete
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </>
            ) : selectedConv && selectedConv.uuid === 'loading' ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Icon icon="solar:refresh-bold" className="w-6 h-6 animate-spin text-primary mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <Icon icon="solar:chat-round-bold" className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                  <p className="text-muted-foreground text-sm">Select a conversation</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Or contact a buyer, seller, or lawyer
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}