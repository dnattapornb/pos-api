export interface ReceiptItem {
    name: string;
    price: number;
}

export interface ReceiptData {
    storeName: string;
    date: string | null;
    totalAmount: number;
    items: ReceiptItem[];
}
