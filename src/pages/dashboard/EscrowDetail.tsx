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
  pending: "bg-yellow-500/10 text-yellow-600",
  under_review: "bg-blue-500/10 text-blue-600",
  buyer_funded: "bg-blue-500/10 text-blue-600",
  seller_confirmed: "bg-purple-500/10 text-purple-600",
  lawyer_approved: "bg-indigo-500/10 text-indigo-600",
  completed: "bg-green-500/10 text-green-600",
  disputed: "bg-red-500/10 text-red-600",
  cancelled: "bg-muted text-muted-foreground",
  refunded: "bg-orange-500/10 text-orange-600",
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

  // ✅ Calculator states (Admin only)
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

  // Check for payment callback on mount
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

  // Fetch escrow on mount or ID change
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

  // Poll for status updates when payment is pending
  useEffect(() => {
    const pendingRef = localStorage.getItem('pending_payment_reference');
    const pendingUuid = localStorage.getItem('pending_escrow_uuid');
    
    if (pendingRef && pendingUuid && escrow?.status === 'pending' && !actionLoading) {
      console.log("⏳ Starting payment status polling...");
      
      const interval = setInterval(() => {
        console.log("🔄 Polling for escrow status...");
        fetchEscrow();
      }, 5000);
      
      setPollingInterval(interval);
      
      const timeout = setTimeout(() => {
        if (interval) {
          clearInterval(interval);
          setPollingInterval(null);
          console.log("⏹️ Polling stopped after timeout");
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
      console.log("✅ Payment confirmed, polling stopped");
    }
  }, [escrow?.status]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current && showChatView) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showChatView]);

  // ✅ Update calculator when escrow changes
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
      console.log("📡 Fetching escrow:", id);
      const response = await EscrowAPI.get(id);
      console.log("📡 Escrow data received:", response.data);
      setEscrow(response.data);
      
      if (response.data.status === 'buyer_funded') {
        const pendingRef = localStorage.getItem('pending_payment_reference');
        if (pendingRef) {
          toast.success("🎉 Payment confirmed successfully!");
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
      console.log("🔍 Verifying payment:", { reference, escrowUuid });
      
      const response = await PaymentAPI.verify(reference);
      console.log("✅ Verification response:", response);
      
      if (response.data && response.data.status === 'success') {
        toast.success("✅ Payment verified successfully!");
        
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
        console.error("❌ Verification failed:", response);
      }
      
    } catch (error) {
      console.error("❌ Verification error:", error);
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
      console.log("💳 Initializing payment for escrow:", id);
      
      const response = await PaymentAPI.initialize(id);
      console.log("💳 Payment initialization response:", response);
      
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
      console.error("❌ Payment initialization error:", error);
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Failed to initialize payment");
      }
      setActionLoading(false);
    }
  }


  // ============ CHAT FUNCTIONS ============
  
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

  // ============ CALCULATOR FUNCTIONS ============
  
  function calculateCommission() {
    if (!escrow) return;
    
    const total = escrow.total_amount;
    const platformFee = parseFloat(escrow.fee || (total * 0.025));
    const lawyerFee = (total * calcInputs.lawyer_fee_percentage) / 100;
    const adminFee = (total * calcInputs.admin_fee_percentage) / 100;
    console.log(platformFee, lawyerFee, lawyerFee)
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

  // Redirect if not authenticated
  if (!isAuthenticated) {
    navigate("/auth/login");
    return null;
  }

  // If chat view is open, show only chat
  if (showChatView) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-4 p-4 rounded-2xl bg-muted">
            <button
              onClick={closeChat}
              className="p-2 hover:bg-background/50 rounded-xl transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Icon icon="solar:arrow-left-bold" className="w-5 h-5" />
              Back to Escrow
            </button>
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                {chatParticipant ? getInitials(chatParticipant.name) : '?'}
              </div>
              <div>
                <p className="font-semibold text-sm">{chatParticipant?.name || 'Unknown'}</p>
                <p className="text-xs text-muted-foreground">
                  {escrow?.property_title || 'Escrow Chat'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-muted rounded-2xl p-4 h-[calc(100vh-18rem)] flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-3 mb-3 p-2 bg-background/50 rounded-lg">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <Icon icon="solar:refresh-bold" className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Icon icon="solar:chat-round-bold" className="w-10 h-10 mb-3 opacity-50" />
                  <p className="text-sm font-medium">No messages yet</p>
                  <p className="text-xs">Start the conversation with {chatParticipant?.name}</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.sender_uuid === user?.uuid;
                  return (
                    <div
                      key={msg.uuid}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] p-3 rounded-2xl ${
                          isOwn
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        <p className="text-sm break-words">{msg.message}</p>
                        <p className={`text-[10px] mt-1 ${
                          isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'
                        }`}>
                          {formatDate(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-3">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !sendingMessage) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={`Message ${chatParticipant?.name || '...'}`}
                className="flex-1 px-4 py-3 rounded-xl bg-background border border-muted-foreground/20 focus:outline-none focus:border-primary text-sm"
                disabled={sendingMessage}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sendingMessage}
                className="px-5 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center gap-2 transition-opacity"
              >
                {sendingMessage ? (
                  <Icon icon="solar:refresh-bold" className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Icon icon="solar:send-bold" className="w-5 h-5" />
                    <span className="hidden sm:inline">Send</span>
                  </>
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
      <div className="max-w-3xl mx-auto space-y-6">
        <button 
          onClick={() => navigate("/dashboard/escrows")} 
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          <Icon icon="solar:arrow-left-bold" className="w-4 h-4" /> Back to escrows
        </button>

        {error && !loading && (
          <div className="text-center py-20">
            <Icon icon="solar:danger-triangle-bold" className="w-10 h-10 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground">{error}</p>
            <button
              onClick={fetchEscrow}
              className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity text-sm"
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
            <div className="p-6 rounded-2xl bg-muted">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-xl font-display font-bold">
                    {escrow.property_title || `Escrow #${id?.slice(-8)}`}
                  </h1>
                  {escrow.created_at && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Created {formatDate(escrow.created_at)}
                    </p>
                  )}
                  {escrow.property_address && (
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                      <Icon icon="solar:map-point-bold" className="w-3 h-3" />
                      {escrow.property_address}, {escrow.property_city}, {escrow.property_state}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${statusColors[escrow.status] || ""}`}>
                    {escrow.status.replace('_', ' ')}
                  </span>
                  {escrow.status === 'pending' && (
                    <button
                      onClick={() => {
                        fetchEscrow();
                        toast.success("Refreshing escrow status...");
                      }}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                      disabled={actionLoading}
                    >
                      <Icon icon="solar:refresh-bold" className="w-3 h-3" />
                      Check payment status
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Property Amount</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(escrow.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Platform Fee (2.5%)</p>
                  <p className="text-lg font-medium">{formatCurrency(escrow.fee)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Amount</p>
                  <p className="text-xl font-bold">{formatCurrency(escrow.total_amount)}</p>
                </div>
              </div>
            </div>

            {/* Admin: Calculator Section */}
            {isAdmin && (
              <div className="p-6 rounded-2xl bg-muted border-2 border-primary/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Icon icon="solar:calculator-bold" className="w-5 h-5 text-primary" />
                    Commission Calculator
                  </h3>
                  <button
                    onClick={() => setShowCalculator(!showCalculator)}
                    className="text-sm text-primary hover:underline"
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
                      <div className="grid grid-cols-2 gap-4">
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
                            className="w-full px-3 py-2 rounded-xl bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
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
                            className="w-full px-3 py-2 rounded-xl bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
                          />
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-background space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Amount</span>
                          <span className="font-bold">{formatCurrency(calcResults.total_amount)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-blue-600">
                          <span>Lawyer Fee ({calcInputs.lawyer_fee_percentage}%)</span>
                          <span>{formatCurrency(calcResults.lawyer_fee)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-purple-600">
                          <span>Admin Fee ({calcInputs.admin_fee_percentage}%)</span>
                          <span>{formatCurrency(calcResults.admin_fee)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-yellow-600">
                          <span>Platform Fee (2.5%)</span>
                          <span>{formatCurrency(calcResults.platform_fee)}</span>
                        </div>
                        <div className="border-t border-border pt-2 flex justify-between text-sm font-bold">
                          <span>Total Commission</span>
                          <span className="text-red-500">{formatCurrency(calcResults.total_commission)}</span>
                        </div>
                        <div className="border-t-2 border-primary pt-2 flex justify-between text-lg font-bold">
                          <span>Seller Receives</span>
                          <span className="text-green-600">{formatCurrency(calcResults.seller_amount)}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Property Details */}
            {(escrow.property_description || escrow.property_bedrooms || escrow.property_type) && (
              <div className="p-6 rounded-2xl bg-muted">
                <h3 className="font-semibold mb-3">Property Details</h3>
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
            <div className="p-6 rounded-2xl bg-muted">
              <h3 className="font-semibold mb-4">Transaction Progress</h3>
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-muted-foreground/20" />
                {statusSteps.map((step, index) => {
                  const completed = isStepCompleted(escrow.status, step.key);
                  const active = isStepActive(escrow.status, step.key);
                  
                  return (
                    <div key={step.key} className="flex items-start gap-4 mb-4 last:mb-0">
                      <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        completed ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'
                      }`}>
                        {completed ? (
                          <Icon icon="solar:check-circle-bold" className="w-5 h-5" />
                        ) : (
                          <span className="text-sm font-medium">{index + 1}</span>
                        )}
                      </div>
                      <div className="pt-1.5">
                        <p className={`text-sm font-medium ${completed ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {step.label}
                        </p>
                        {active && (
                          <p className="text-xs text-primary mt-0.5">In progress...</p>
                        )}
                        {step.key === 'completed' && escrow.released_at && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(escrow.released_at)}
                          </p>
                        )}
                        {step.key === 'buyer_funded' && escrow.funded_at && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Funded {formatDate(escrow.funded_at)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Parties with Full Details - Enhanced for Admin */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <div key={party.label} className="p-4 rounded-2xl bg-muted">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">{party.label}</p>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                          {getInitials(party.name!)}
                        </div>
                        <div>
                          <p className="font-medium text-sm truncate">{party.name}</p>
                          {party.uuid && (
                            <p className="text-xs text-muted-foreground truncate">{party.uuid.slice(0, 8)}...</p>
                          )}
                          {party.isUser && (
                            <span className="text-xs text-primary font-medium">(You)</span>
                          )}
                        </div>
                      </div>
                      {(party.email || party.phone) && (
                        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                          {party.email && <p className="truncate">{party.email}</p>}
                          {party.phone && <p className="truncate">{party.phone}</p>}
                        </div>
                      )}
                    </div>
                    {!party.isUser && party.uuid && (
                      <button
                        onClick={() => {
                          if (party.email) {
                            window.location.href = `mailto:${party.email}`;
                          }
                        }}
                        className="p-2 rounded-lg hover:bg-primary/10 transition-colors"
                        title={`Contact ${party.label}`}
                      >
                        <Icon icon="solar:letter-bold" className="w-4 h-4 text-primary" />
                      </button>
                    )}
                  </div>
                  
                  {/* Bank Details - Only show for Admin */}
                  {isAdmin && (party.bank_name || party.account_number) && (
                    <div className="mt-2 p-2 rounded-lg bg-background/50">
                      <p className="text-[10px] text-muted-foreground font-medium mb-1">Bank Details</p>
                      {party.bank_name && (
                        <p className="text-xs truncate">Bank: {party.bank_name}</p>
                      )}
                      {party.account_number && (
                        <p className="text-xs truncate">Account: {party.account_number}</p>
                      )}
                      {party.account_name && (
                        <p className="text-xs truncate">Name: {party.account_name}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Payment Reference */}
            {escrow.payment_reference && (
              <div className="p-4 rounded-2xl bg-muted">
                <p className="text-xs text-muted-foreground">Payment Reference</p>
                <p className="font-mono text-sm mt-1">{escrow.payment_reference}</p>
              </div>
            )}

            {/* Role-based Actions */}
            <div className="space-y-3">
              {user?.role === "buyer" && escrow.status === "pending" && (
                <div className="space-y-3">
                  <button
                    onClick={handleFund}
                    disabled={actionLoading}
                    className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {actionLoading && <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />}
                    <Icon icon="solar:card-bold" className="w-4 h-4" />
                    {actionLoading ? "Processing..." : "Fund Escrow (Pay Now)"}
                  </button>
                  <p className="text-xs text-center text-muted-foreground">
                    You will be redirected to Paystack to complete payment
                  </p>
                </div>
              )}

              {user?.role === "seller" && escrow.status === "buyer_funded" && (
                <button
                  onClick={handleSellerConfirm}
                  disabled={actionLoading}
                  className="w-full py-3 bg-green-500 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
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
                  className="w-full py-3 bg-blue-500 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
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
                  className="w-full py-3 bg-green-500 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionLoading && <Icon icon="solar:refresh-bold" className="w-4 h-4 animate-spin" />}
                  <Icon icon="solar:hand-money-bold" className="w-4 h-4" />
                  {actionLoading ? "Releasing..." : "Release Funds"}
                </button>
              )}

              {user && escrow && (
                <button
                  onClick={openChat}
                  className="w-full py-3 bg-primary/10 text-primary font-semibold rounded-xl hover:bg-primary/20 flex items-center justify-center gap-2 transition-colors"
                >
                  <Icon icon="solar:chat-round-bold" className="w-5 h-5" />
                  Chat with {getChatParticipantName()}
                </button>
              )}

              {/* Status Messages */}
              {escrow.status === "completed" && (
                <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-center">
                  <Icon icon="solar:check-circle-bold" className="w-6 h-6 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-green-600 font-medium">Transaction Completed Successfully</p>
                  <p className="text-xs text-green-500/70 mt-1">
                    Funds have been released to the seller
                  </p>
                </div>
              )}

              {escrow.status === "disputed" && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
                  <Icon icon="solar:danger-triangle-bold" className="w-6 h-6 text-red-500 mx-auto mb-2" />
                  <p className="text-sm text-red-600 font-medium">Dispute Active</p>
                  <p className="text-xs text-red-500/70 mt-1">
                    This transaction is under dispute. Please contact support.
                  </p>
                </div>
              )}

              {escrow.status === "cancelled" && (
                <div className="p-4 rounded-2xl bg-muted text-center">
                  <Icon icon="solar:close-circle-bold" className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground font-medium">Transaction Cancelled</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    This transaction has been cancelled
                  </p>
                </div>
              )}

              {escrow.status === "refunded" && (
                <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-center">
                  <Icon icon="solar:arrow-left-bold" className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                  <p className="text-sm text-orange-600 font-medium">Refunded</p>
                  <p className="text-xs text-orange-500/70 mt-1">
                    Funds have been refunded to the buyer
                  </p>
                </div>
              )}

              {escrow.status === "pending" && user?.role === "buyer" && (
                <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-center">
                  <Icon icon="solar:clock-circle-bold" className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                  <p className="text-sm text-blue-600 font-medium">Awaiting Payment</p>
                  <p className="text-xs text-blue-500/70 mt-1">
                    Click "Fund Escrow" to complete your payment
                  </p>
                </div>
              )}

              {escrow.status === "pending" && actionLoading && (
                <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-center">
                  <Icon icon="solar:refresh-bold" className="w-6 h-6 text-yellow-500 mx-auto mb-2 animate-spin" />
                  <p className="text-sm text-yellow-600 font-medium">Processing Payment</p>
                  <p className="text-xs text-yellow-500/70 mt-1">
                    Please wait while we confirm your payment...
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}