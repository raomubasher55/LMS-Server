const mongoose = require("mongoose");

const withdrawalRequestSchema = new mongoose.Schema({
  instructor: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  bankDetails: {
    accountNumber: { 
      type: String, 
      required: true 
    },
    accountName: { 
      type: String, 
      required: true 
    },
    bankName: { 
      type: String, 
      required: true 
    },
    accountType: { 
      type: String, 
      enum: ["savings", "checking", "business"], 
      default: "savings" 
    },
    routingNumber: { 
      type: String 
    },
    swiftCode: { 
      type: String 
    },
    branchAddress: { 
      type: String 
    }
  },
  status: { 
    type: String, 
    enum: ["pending", "under_review", "approved", "completed", "rejected"], 
    default: "pending" 
  },
  requestDate: { 
    type: Date, 
    default: Date.now 
  },
  processedDate: { 
    type: Date 
  },
  processedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  },
  rejectionReason: { 
    type: String 
  },
  adminNotes: { 
    type: String 
  },
  transactionId: { 
    type: String 
  },
  paymentMethod: { 
    type: String, 
    enum: ["bank_transfer", "paypal", "check", "wire_transfer"], 
    default: "bank_transfer" 
  },
  fees: { 
    type: Number, 
    default: 0 
  },
  netAmount: { 
    type: Number 
  }
});

// Calculate net amount before saving
withdrawalRequestSchema.pre('save', function(next) {
  if (this.isModified('amount') || this.isModified('fees')) {
    this.netAmount = this.amount - (this.fees || 0);
  }
  next();
});

// Update processed date when status changes to approved or completed
withdrawalRequestSchema.pre('save', function(next) {
  if (this.isModified('status') && 
      (this.status === 'approved' || this.status === 'completed' || this.status === 'rejected')) {
    if (!this.processedDate) {
      this.processedDate = Date.now();
    }
  }
  next();
});

module.exports = mongoose.model("WithdrawalRequest", withdrawalRequestSchema);