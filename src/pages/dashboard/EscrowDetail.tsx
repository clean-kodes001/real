import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { EscrowAPI, PaymentAPI, ChatAPI, ApiError } from "@/services/api";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";

// Paystack types
declare global {
  interface Window {
    PaystackPop: any;
  }
}

const statusColors: Record<string, string> = {
  pending: "text-amber-500",
  under_review: "text-blue-500",
  buyer_funded: "text-blue-500",
  seller_confirmed: "text-purple-500",
  lawyer_approved: "text-indigo-500",
  completed: "text-emerald-500",
  disputed: "text-red-500",
  cancelled: "text-muted-foreground",
  refunded: "text-orange-500",
};

const statusBgColors: Record<string, string> = {
  pending: "bg-amber-500/10",
  under_review: "bg-blue-500/10",
  buyer_funded: "bg-blue-500/10",
  seller_confirmed: "bg-purple-500/10",
  lawyer_approved: "bg-indigo-500/10",
  completed: "bg-emerald-500/10",
  disputed: "bg-red-500/10",
  cancelled: "bg-muted/30",
  refunded: "bg-orange-500/10",
};

const statusSteps = [
  { key: 'pending', label: 'Created' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'buyer_funded', label: 'Funded' },
  { key: 'seller_confirmed', label: 'Seller Confirmed' },
  { key: 'lawyer_approved', label: 'Lawyer Approved' },
  { key: 'completed', label: 'Completed' },
];

interface EscrowData {
  uuid: string;
  property_uuid: string;
  property_title: string;
  property_description?: string;
  property_address?: string;
  property_city?: string;
  property_state?: string;
  property_country?: string;
  property_bedrooms?: number;
  property_bathrooms?: number;
  property_type?: string;
  property_price?: number;
  buyer_uuid: string;
  buyer_name: string;
  buyer_email?: string;
  buyer_phone?: string;
  buyer_bank_name?: string;
  buyer_account_number?: string;
  buyer_account_name?: string;
  seller_uuid: string;
  seller_name: string;
  seller_email?: string;
  seller_phone?: string;
  seller_bank_name?: string;
  seller_account_number?: string;
  seller_account_name?: string;
  lawyer_uuid: string;
  lawyer_name: string;
  lawyer_email?: string;
  lawyer_phone?: string;
  lawyer_bank_name?: string;
  lawyer_account_number?: string;
  lawyer_account_name?: string;
  amount: number;
  fee: number;
  total_amount: number;
  status: 'pending' | 'under_review' | 'buyer_funded' | 'seller_confirmed' | 'lawyer_approved' | 'completed' | 'cancelled' | 'disputed' | 'refunded';
  payment_reference: string;
  funded_at: string;
  seller_confirmed_at: string;
  lawyer_approved_at: string;
  released_at: string;
  created_at: string;
}

interface Message {
  uuid: string;
  sender_uuid: string;
  receiver_uuid: string;
  message: string;
  message_type: 'text' | 'image' | 'file';
  is_read: boolean;
  created_at: string;
  sender_name?: string;
}

interface Conversation {
  uuid: string;
  participants: string[];
  other_uuid?: string;
  other_user?: {
    name: string;
    email?: string;
    photo?: string;
  };
  last_message?: string;
  last_message_at?: string;
  created_at: string;
  unread_count: number;
}

export default function EscrowDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [escrow, setEscrow] = useState<EscrowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Chat states
  const [showChatView, setShowChatView] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [conversationUuid, setConversationUuid] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [chatParticipant, setChatParticipant] = useState<{ name: string; uuid: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInterval = useRef<NodeJS.Timeout | null>(null);

  // Calculator states (Admin only)
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcInputs, setCalcInputs] = useState({
    lawyer_fee_percentage: 1.0,
    admin_fee_percentage: 0.5,
  });
  const [calcResults, setCalcResults] = useState({
    total_amount: 0,
    lawyer_fee: 0,
    admin_fee: 0,
    platform_fee: 0,
    seller_amount: 0,
    total_commission: 0,
  });

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference');
    const escrowUuid = params.get('escrow_uuid');
    const trxref = params.get('trxref');
    const paymentStatus = params.get('payment_status');
    const message = params.get('message');
    
    if (paymentStatus === 'success' && message) {
      toast.success(decodeURIComponent(message));
    } else if (paymentStatus === 'error' && message) {
      toast.error(decodeURIComponent(message));
    }
    
    const paymentRef = reference || trxref;
    
    if (paymentRef && escrowUuid) {
      console.log("🔍 Payment callback detected:", { paymentRef, escrowUuid });
      verifyPayment(paymentRef, escrowUuid);
    }
  }, []);

  useEffect(() => {
    if (id) {
      fetchEscrow();
    }
    
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      if (chatInterval.current) {
        clearInterval(chatInterval.current);
      }
    };
  }, [id]);

  useEffect(() => {
    const pendingRef = localStorage.getItem('pending_payment_reference');
    const pendingUuid = localStorage.getItem('pending_escrow_uuid');
    
    if (pendingRef && pendingUuid && escrow?.status === 'pending' && !actionLoading) {
      const interval = setInterval(() => {
        fetchEscrow();
      }, 5000);
      
      setPollingInterval(interval);
      
      const timeout = setTimeout(() => {
        if (interval) {
          clearInterval(interval);
          setPollingInterval(null);
        }
        localStorage.removeItem('pending_payment_reference');
        localStorage.removeItem('pending_escrow_uuid');
      }, 180000);
      
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
        setPollingInterval(null);
      };
    }
    
    if (escrow?.status === 'buyer_funded' && pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
      localStorage.removeItem('pending_payment_reference');
      localStorage.removeItem('pending_escrow_uuid');
    }
  }, [escrow?.status]);

  useEffect(() => {
    if (messagesEndRef.current && showChatView) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showChatView]);

  useEffect(() => {
    if (escrow && isAdmin) {
      calculateCommission();
    }
  }, [escrow, calcInputs]);

  async function fetchEscrow() {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await EscrowAPI.get(id);
      setEscrow(response.data);
      
      if (response.data.status === 'buyer_funded') {
        const pendingRef = localStorage.getItem('pending_payment_reference');
        if (pendingRef) {
          toast.success("Payment confirmed successfully!");
          localStorage.removeItem('pending_payment_reference');
          localStorage.removeItem('pending_escrow_uuid');
        }
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
        setError(error.message);
      } else {
        toast.error("Failed to load escrow details");
        setError("Failed to load escrow details");
      }
    } finally {
      setLoading(false);
    }
  }

  async function verifyPayment(reference: string, escrowUuid: string) {
    setActionLoading(true);
    try {
      const response = await PaymentAPI.verify(reference);
      
      if (response.data && response.data.status === 'success') {
        toast.success("Payment verified successfully!");
        
        localStorage.setItem('pending_payment_reference', reference);
        localStorage.setItem('pending_escrow_uuid', escrowUuid);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        await fetchEscrow();
        
        if (window.history.replaceState) {
          const cleanUrl = `/dashboard/escrow/${escrowUuid}`;
          window.history.replaceState({}, '', cleanUrl);
        }
        
        if (escrow?.status !== 'buyer_funded') {
          toast.loading("Waiting for payment confirmation...", { duration: 10000 });
        }
        
      } else {
        toast.error("Payment verification failed. Please contact support.");
      }
      
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Payment verification failed. Please try again.");
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleFund() {
    if (!id || !escrow) return;

    setActionLoading(true);
    try {
      const response = await PaymentAPI.initialize(id);
      
      const { authorization_url, reference } = response.data;
      
      if (authorization_url) {
        localStorage.setItem('pending_payment_reference', reference);
        localStorage.setItem('pending_escrow_uuid', id);
        
        toast.loading("Redirecting to Paystack...", { duration: 3000 });
        window.location.href = authorization_url;
      } else {
        toast.error('Failed to initialize payment');
        setActionLoading(false);
      }
      
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to initialize payment");
      }
      setActionLoading(false);
    }
  }

  async function openChat() {
    if (!escrow || !user) return;
    
    const participantName = user.role === 'buyer' ? escrow.seller_name : 
                            user.role === 'seller' ? escrow.buyer_name : 
                            escrow.buyer_name;
    const participantUuid = user.role === 'buyer' ? escrow.seller_uuid : 
                            user.role === 'seller' ? escrow.buyer_uuid : 
                            escrow.buyer_uuid;
    
    setChatParticipant({ name: participantName, uuid: participantUuid });
    setShowChatView(true);
    setLoadingMessages(true);
    
    try {
      const response = await ChatAPI.getConversations();
      let conversationsData = response?.conversations || [];
      if (!Array.isArray(conversationsData)) {
        conversationsData = [];
      }
      
      setConversations(conversationsData);
      
      let existingConv = null;
      for (const conv of conversationsData) {
        if (conv.other_uuid === participantUuid || 
            (conv.participants && conv.participants.includes(participantUuid))) {
          existingConv = conv;
          break;
        }
      }
      
      if (existingConv) {
        setConversationUuid(existingConv.uuid);
        await loadMessages(existingConv.uuid);
      } else {
        setConversationUuid(null);
        setMessages([]);
      }
      
      if (chatInterval.current) {
        clearInterval(chatInterval.current);
      }
      chatInterval.current = setInterval(() => {
        if (conversationUuid) {
          loadMessages(conversationUuid, true);
        }
      }, 5000);
      
    } catch (error) {
      console.error("Failed to load chat:", error);
      toast.error("Failed to load chat");
    } finally {
      setLoadingMessages(false);
    }
  }

  function closeChat() {
    setShowChatView(false);
    setMessages([]);
    setConversationUuid(null);
    setChatParticipant(null);
    if (chatInterval.current) {
      clearInterval(chatInterval.current);
      chatInterval.current = null;
    }
  }

  async function loadMessages(convUuid: string, silent: boolean = false) {
    if (!convUuid) return;
    
    try {
      const response = await ChatAPI.getMessages(convUuid);
      const messagesData = response?.messages || response || [];
      setMessages(Array.isArray(messagesData) ? messagesData : []);
      
      if (messagesData.length > 0) {
        await ChatAPI.markAsRead(convUuid);
      }
    } catch (error) {
      if (!silent) {
        console.error("Failed to load messages:", error);
        toast.error("Failed to load messages");
      }
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !user || !escrow || !chatParticipant) return;
    
    if (!conversationUuid) {
      setSendingMessage(true);
      try {
        const response = await ChatAPI.sendMessage({
          receiver_uuid: chatParticipant.uuid,
          message: newMessage.trim(),
          message_type: 'text'
        });
        
        const messageData = response || response.data;
        setMessages([...messages, messageData]);
        setNewMessage("");
        
        if (messageData.conversation_uuid) {
          setConversationUuid(messageData.conversation_uuid);
        }
        
        const convResponse = await ChatAPI.getConversations();
        setConversations(convResponse?.conversations || []);
        
      } catch (error) {
        console.error("Failed to send message:", error);
        toast.error("Failed to send message. Please try again.");
      } finally {
        setSendingMessage(false);
      }
      return;
    }
    
    setSendingMessage(true);
    try {
      const response = await ChatAPI.sendMessage({
        conversation_uuid: conversationUuid,
        receiver_uuid: chatParticipant.uuid,
        message: newMessage.trim(),
        message_type: 'text'
      });
      
      const messageData = response || response.data;
      setMessages([...messages, messageData]);
      setNewMessage("");
      
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  }

  async function handleSellerConfirm() {
    if (!id || !escrow) return;
    
    setActionLoading(true);
    try {
      await EscrowAPI.sellerConfirm(id);
      toast.success("Transaction confirmed successfully!");
      await fetchEscrow();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to confirm transaction");
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLawyerApprove() {
    if (!id || !escrow) return;
    
    setActionLoading(true);
    try {
      await EscrowAPI.lawyerApprove(id);
      toast.success("Escrow approved successfully!");
      await fetchEscrow();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to approve escrow");
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRelease() {
    if (!id || !escrow) return;
    
    if (!confirm("Are you sure you want to release the funds to the seller?")) return;
    
    setActionLoading(true);
    try {
      await EscrowAPI.release(id);
      toast.success("Funds released successfully!");
      await fetchEscrow();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to release funds");
      }
    } finally {
      setActionLoading(false);
    }
  }

  function calculateCommission() {
    if (!escrow) return;
    
    const total = escrow.total_amount;
    const platformFee = parseFloat(escrow.fee || (total * 0.025));
    const lawyerFee = (total * calcInputs.lawyer_fee_percentage) / 100;
    const adminFee = (total * calcInputs.admin_fee_percentage) / 100;
    const totalCommission = lawyerFee + adminFee + platformFee;
    const sellerAmount = total - totalCommission;
    
    setCalcResults({
      total_amount: total,
      lawyer_fee: lawyerFee,
      admin_fee: adminFee,
      platform_fee: platformFee,
      seller_amount: sellerAmount,
      total_commission: totalCommission,
    });
  }

  function updateCalcInput(key: string, value: string) {
    const numValue = parseFloat(value) || 0;
    setCalcInputs(prev => ({
      ...prev,
      [key]: numValue
    }));
  }

  function getChatParticipantName(): string {
    if (!user || !escrow) return '';
    if (user.role === 'buyer') return escrow.seller_name;
    if (user.role === 'seller') return escrow.buyer_name;
    return escrow.buyer_name;
  }

  function getCurrentStepIndex(status: string): number {
    return statusSteps.findIndex(step => step.key === status);
  }

  function isStepCompleted(status: string, stepKey: string): boolean {
    const currentIndex = getCurrentStepIndex(status);
    const stepIndex = statusSteps.findIndex(step => step.key === stepKey);
    return stepIndex <= currentIndex;
  }

  function isStepActive(status: string, stepKey: string): boolean {
    return getCurrentStepIndex(status) === statusSteps.findIndex(step => step.key === stepKey);
  }

  if (!isAuthenticated) {
    navigate("/auth/login");
    return null;
  }

  // Chat View
  if (showChatView) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-muted/30">
            <button
              onClick={closeChat}
              className="p-2 rounded-lg hover:bg-muted/50 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Icon icon="solar:arrow-left-bold" className="w-4 h-4" />
              Back
            </button>
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium">
                {chatParticipant ? getInitials(chatParticipant.name) : '?'}
              </div>
              <div>
                <p className="font-medium text-sm">{chatParticipant?.name || 'Unknown'}</p>
                <p className="text-xs text-muted-foreground/60">{escrow?.property_title || 'Escrow Chat'}</p>
              </div>
            </div>
          </div>

          <div className="bg-muted/30 rounded-2xl p-4 h-[calc(100vh-18rem)] flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-2 mb-3 p-2">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <Icon icon="solar:refresh-bold" className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                    <Icon icon="solar:chat-round-bold" className="w-6 h-6 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium">No messages yet</p>
                  <p className="text-xs text-muted-foreground/60">Start the conversation</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.sender_uuid === user?.uuid;
                  return (
                    <motion.div
                      key={msg.uuid}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                          isOwn
                            ? 'bg-foreground text-background'
                            : 'bg-muted/50 text-foreground'
                        }`}
                      >
                        <p className="break-words">{msg.message}</p>
                        <p className={`text-[10px] mt-1 ${
                          isOwn ? 'text-background/60' : 'text-muted-foreground/60'
                        }`}>
                          {formatDate(msg.created_at)}
                        </p>
                      </div>
                    </motion.div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={`Message ${chatParticipant?.name || '...'}`}
                className="flex-1 px-4 py-2.5 rounded-xl bg-background text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                disabled={sendingMessage}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sendingMessage}
                className="px-4 py-2.5 bg-foreground text-background rounded-xl hover:opacity-80 disabled:opacity-30 transition-opacity"
              >
                {sendingMessage ? (
                  <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />
                ) : (
                  <Icon icon="solar:plain-bold" className="w-4 h-4" />
                )}
              </button>
            </form>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Main escrow detail view
  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button 
          onClick={() => navigate("/dashboard/escrows")} 
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <Icon icon="solar:arrow-left-bold" className="w-4 h-4" /> Back
        </button>

        {error && !loading && (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <Icon icon="solar:danger-triangle-bold" className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-muted-foreground text-sm">{error}</p>
            <button
              onClick={fetchEscrow}
              className="mt-4 px-6 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 transition-opacity"
            >
              Try Again
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : escrow ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            {/* Header Card */}
            <div className="p-6 rounded-2xl bg-muted/30">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-xl font-light tracking-tight">
                    {escrow.property_title || `Escrow #${id?.slice(-8)}`}
                  </h1>
                  {escrow.created_at && (
                    <p className="text-sm text-muted-foreground/60 mt-1">
                      {formatDate(escrow.created_at)}
                    </p>
                  )}
                  {escrow.property_address && (
                    <p className="text-sm text-muted-foreground/60 mt-1 flex items-center gap-1">
                      <Icon icon="solar:map-point-bold" className="w-3 h-3" />
                      {escrow.property_address}, {escrow.property_city}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-sm font-medium capitalize ${statusColors[escrow.status] || ""}`}>
                    {escrow.status.replace('_', ' ')}
                  </span>
                  {escrow.status === 'pending' && (
                    <button
                      onClick={() => {
                        fetchEscrow();
                        toast.success("Refreshing status...");
                      }}
                      className="text-xs text-primary hover:opacity-80 flex items-center gap-1"
                      disabled={actionLoading}
                    >
                      <Icon icon="solar:refresh-bold" className="w-3 h-3" />
                      Check payment
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Amount</p>
                  <p className="text-2xl font-light text-primary">{formatCurrency(escrow.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Fee</p>
                  <p className="text-lg font-light">{formatCurrency(escrow.fee)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
                  <p className="text-xl font-light">{formatCurrency(escrow.total_amount)}</p>
                </div>
              </div>
            </div>

            {/* Admin Calculator */}
            {isAdmin && (
              <div className="p-5 rounded-2xl bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Commission Calculator</h3>
                  <button
                    onClick={() => setShowCalculator(!showCalculator)}
                    className="text-xs text-primary hover:opacity-80 transition-opacity"
                  >
                    {showCalculator ? 'Hide' : 'Show'}
                  </button>
                </div>

                <AnimatePresence>
                  {showCalculator && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Lawyer Fee (%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={calcInputs.lawyer_fee_percentage}
                            onChange={(e) => updateCalcInput('lawyer_fee_percentage', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-background text-sm outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Admin Fee (%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={calcInputs.admin_fee_percentage}
                            onChange={(e) => updateCalcInput('admin_fee_percentage', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-background text-sm outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-background space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Amount</span>
                          <span className="font-medium">{formatCurrency(calcResults.total_amount)}</span>
                        </div>
                        <div className="flex justify-between text-blue-500">
                          <span>Lawyer Fee ({calcInputs.lawyer_fee_percentage}%)</span>
                          <span>{formatCurrency(calcResults.lawyer_fee)}</span>
                        </div>
                        <div className="flex justify-between text-purple-500">
                          <span>Admin Fee ({calcInputs.admin_fee_percentage}%)</span>
                          <span>{formatCurrency(calcResults.admin_fee)}</span>
                        </div>
                        <div className="flex justify-between text-amber-500">
                          <span>Platform Fee</span>
                          <span>{formatCurrency(calcResults.platform_fee)}</span>
                        </div>
                        <div className="border-t border-border/30 pt-1.5 flex justify-between font-medium">
                          <span>Total Commission</span>
                          <span className="text-red-500">{formatCurrency(calcResults.total_commission)}</span>
                        </div>
                        <div className="border-t-2 border-primary pt-1.5 flex justify-between text-lg font-light">
                          <span>Seller Receives</span>
                          <span className="text-emerald-500">{formatCurrency(calcResults.seller_amount)}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Property Details */}
            {(escrow.property_description || escrow.property_bedrooms || escrow.property_type) && (
              <div className="p-5 rounded-2xl bg-muted/30">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Property Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {escrow.property_type && (
                    <div>
                      <p className="text-xs text-muted-foreground">Type</p>
                      <p className="text-sm font-medium capitalize">{escrow.property_type.replace('_', ' ')}</p>
                    </div>
                  )}
                  {escrow.property_bedrooms !== undefined && escrow.property_bedrooms > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">Bedrooms</p>
                      <p className="text-sm font-medium">{escrow.property_bedrooms}</p>
                    </div>
                  )}
                  {escrow.property_bathrooms !== undefined && escrow.property_bathrooms > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">Bathrooms</p>
                      <p className="text-sm font-medium">{escrow.property_bathrooms}</p>
                    </div>
                  )}
                  {escrow.property_price && (
                    <div>
                      <p className="text-xs text-muted-foreground">Listed Price</p>
                      <p className="text-sm font-medium">{formatCurrency(escrow.property_price)}</p>
                    </div>
                  )}
                </div>
                {escrow.property_description && (
                  <p className="text-sm text-muted-foreground mt-3">{escrow.property_description}</p>
                )}
              </div>
            )}

            {/* Status Timeline */}
            <div className="p-5 rounded-2xl bg-muted/30">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Progress</h3>
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-muted-foreground/20" />
                {statusSteps.map((step, index) => {
                  const completed = isStepCompleted(escrow.status, step.key);
                  const active = isStepActive(escrow.status, step.key);
                  
                  return (
                    <div key={step.key} className="flex items-start gap-4 mb-4 last:mb-0">
                      <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        completed ? 'bg-foreground text-background' : 'bg-muted/50 text-muted-foreground'
                      }`}>
                        {completed ? (
                          <Icon icon="solar:check-circle-bold" className="w-4 h-4" />
                        ) : (
                          <span className="text-xs font-medium">{index + 1}</span>
                        )}
                      </div>
                      <div className="pt-1">
                        <p className={`text-sm font-medium ${completed ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {step.label}
                        </p>
                        {active && (
                          <p className="text-xs text-primary mt-0.5">In progress...</p>
                        )}
                        {step.key === 'completed' && escrow.released_at && (
                          <p className="text-xs text-muted-foreground/60 mt-0.5">
                            {formatDate(escrow.released_at)}
                          </p>
                        )}
                        {step.key === 'buyer_funded' && escrow.funded_at && (
                          <p className="text-xs text-muted-foreground/60 mt-0.5">
                            {formatDate(escrow.funded_at)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { 
                  label: "Buyer", 
                  name: escrow.buyer_name, 
                  uuid: escrow.buyer_uuid,
                  email: escrow.buyer_email,
                  phone: escrow.buyer_phone,
                  bank_name: escrow.buyer_bank_name,
                  account_number: escrow.buyer_account_number,
                  account_name: escrow.buyer_account_name,
                  isUser: user?.uuid === escrow.buyer_uuid
                },
                { 
                  label: "Seller", 
                  name: escrow.seller_name, 
                  uuid: escrow.seller_uuid,
                  email: escrow.seller_email,
                  phone: escrow.seller_phone,
                  bank_name: escrow.seller_bank_name,
                  account_number: escrow.seller_account_number,
                  account_name: escrow.seller_account_name,
                  isUser: user?.uuid === escrow.seller_uuid
                },
                { 
                  label: "Lawyer", 
                  name: escrow.lawyer_name, 
                  uuid: escrow.lawyer_uuid,
                  email: escrow.lawyer_email,
                  phone: escrow.lawyer_phone,
                  bank_name: escrow.lawyer_bank_name,
                  account_number: escrow.lawyer_account_number,
                  account_name: escrow.lawyer_account_name,
                  isUser: user?.uuid === escrow.lawyer_uuid
                },
              ].filter(p => p.name).map(party => (
                <div key={party.label} className="p-4 rounded-xl bg-muted/30">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{party.label}</p>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium">
                      {getInitials(party.name!)}
                    </div>
                    <div>
                      <p className="font-medium text-sm truncate">{party.name}</p>
                      {party.isUser && (
                        <span className="text-xs text-primary">You</span>
                      )}
                    </div>
                  </div>
                  {(party.email || party.phone) && (
                    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground/60">
                      {party.email && <p className="truncate">{party.email}</p>}
                      {party.phone && <p className="truncate">{party.phone}</p>}
                    </div>
                  )}
                  
                  {/* Bank Details - Admin only */}
                  {isAdmin && (party.bank_name || party.account_number) && (
                    <div className="mt-2 p-2 rounded-lg bg-background/50">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Bank Details</p>
                      {party.bank_name && <p className="text-xs truncate">{party.bank_name}</p>}
                      {party.account_number && <p className="text-xs truncate">#{party.account_number}</p>}
                      {party.account_name && <p className="text-xs truncate text-muted-foreground/60">{party.account_name}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Payment Reference */}
            {escrow.payment_reference && (
              <div className="p-4 rounded-xl bg-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Reference</p>
                <p className="font-mono text-sm mt-1">{escrow.payment_reference}</p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              {user?.role === "buyer" && escrow.status === "pending" && (
                <button
                  onClick={handleFund}
                  disabled={actionLoading}
                  className="w-full py-3 bg-foreground text-background rounded-xl text-sm font-medium hover:opacity-80 disabled:opacity-30 flex items-center justify-center gap-2 transition-opacity"
                >
                  {actionLoading && <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />}
                  <Icon icon="solar:card-bold" className="w-4 h-4" />
                  {actionLoading ? "Processing..." : "Fund Escrow"}
                </button>
              )}

              {user?.role === "seller" && escrow.status === "buyer_funded" && (
                <button
                  onClick={handleSellerConfirm}
                  disabled={actionLoading}
                  className="w-full py-3 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:opacity-80 disabled:opacity-30 flex items-center justify-center gap-2 transition-opacity"
                >
                  {actionLoading && <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />}
                  <Icon icon="solar:check-circle-bold" className="w-4 h-4" />
                  {actionLoading ? "Confirming..." : "Confirm Transaction"}
                </button>
              )}

              {user?.role === "lawyer" && escrow.status === "seller_confirmed" && (
                <button
                  onClick={handleLawyerApprove}
                  disabled={actionLoading}
                  className="w-full py-3 bg-blue-500 text-white rounded-xl text-sm font-medium hover:opacity-80 disabled:opacity-30 flex items-center justify-center gap-2 transition-opacity"
                >
                  {actionLoading && <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />}
                  <Icon icon="solar:shield-check-bold" className="w-4 h-4" />
                  {actionLoading ? "Approving..." : "Approve as Lawyer"}
                </button>
              )}

              {user?.role === "admin" && escrow.status === "lawyer_approved" && (
                <button
                  onClick={handleRelease}
                  disabled={actionLoading}
                  className="w-full py-3 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:opacity-80 disabled:opacity-30 flex items-center justify-center gap-2 transition-opacity"
                >
                  {actionLoading && <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />}
                  <Icon icon="solar:hand-money-bold" className="w-4 h-4" />
                  {actionLoading ? "Releasing..." : "Release Funds"}
                </button>
              )}

              {user && escrow && (
                <button
                  onClick={openChat}
                  className="w-full py-3 bg-primary/5 text-primary rounded-xl text-sm font-medium hover:bg-primary/10 flex items-center justify-center gap-2 transition-colors"
                >
                  <Icon icon="solar:chat-round-bold" className="w-4 h-4" />
                  Chat with {getChatParticipantName()}
                </button>
              )}

              {/* Status Messages */}
              {escrow.status === "completed" && (
                <div className="p-4 rounded-xl bg-emerald-500/5 text-center">
                  <Icon icon="solar:check-circle-bold" className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm text-emerald-600 font-medium">Transaction Completed</p>
                  <p className="text-xs text-emerald-500/70">Funds have been released</p>
                </div>
              )}

              {escrow.status === "disputed" && (
                <div className="p-4 rounded-xl bg-red-500/5 text-center">
                  <Icon icon="solar:danger-triangle-bold" className="w-5 h-5 text-red-500 mx-auto mb-2" />
                  <p className="text-sm text-red-600 font-medium">Dispute Active</p>
                  <p className="text-xs text-red-500/70">Contact support</p>
                </div>
              )}

              {escrow.status === "pending" && user?.role === "buyer" && (
                <div className="p-4 rounded-xl bg-blue-500/5 text-center">
                  <Icon icon="solar:clock-circle-bold" className="w-5 h-5 text-blue-500 mx-auto mb-2" />
                  <p className="text-sm text-blue-600 font-medium">Awaiting Payment</p>
                  <p className="text-xs text-blue-500/70">Click "Fund Escrow" to pay</p>
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}