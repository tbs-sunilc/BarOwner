import { NextResponse } from 'next/server';

export async function GET() {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 700));

  const bills = [
    { 
      tbl: 'T1', 
      name: 'Kiran B.', 
      total: '₹1,250', 
      items: [
        { qty: 1, item: 'Chicken Wings', price: '₹480', status: 'Served' },
        { qty: 2, item: 'Lemon Soda', price: '₹240', status: 'Served' },
        { qty: 1, item: 'Peanut Masala', price: '₹120', status: 'Served' },
      ],
      status: 'Served' 
    },
    { 
      tbl: 'T7', 
      name: 'Arjun M.', 
      total: '₹4,820', 
      items: [
        { qty: 1, item: 'Veg Platter (Large)', price: '₹850', status: 'Served' },
        { qty: 2, item: 'Paneer Tikka', price: '₹700', status: 'Served' },
        { qty: 4, item: 'Masala Peanuts', price: '₹480', status: 'Served' },
        { qty: 3, item: 'Lemon Soda', price: '₹360', status: 'Served' },
        { qty: 1, item: 'Chilli Chicken', price: '₹450', status: 'Cooking' },
        { qty: 2, item: 'Coke (Canned)', price: '₹180', status: 'Served' },
      ],
      status: 'Cooking', 
      active: true 
    },
    { 
      tbl: 'T4', 
      name: 'Meena R.', 
      total: '₹890', 
      items: [
        { qty: 1, item: 'French Fries', price: '₹250', status: 'Served' },
        { qty: 1, item: 'Club Sandwich', price: '₹450', status: 'Served' },
      ],
      status: 'Served' 
    },
    { 
      tbl: 'T2', 
      name: 'Guest', 
      total: '₹2,400', 
      items: [
        { qty: 2, item: 'Margherita Pizza', price: '₹1200', status: 'Pending' },
        { qty: 1, item: 'Garlic Bread', price: '₹350', status: 'Pending' },
      ],
      status: 'Pending' 
    },
    { 
      tbl: 'T6', 
      name: 'Priya S.', 
      total: '₹1,100', 
      items: [
        { qty: 2, item: 'Pasta Carbonara', price: '₹900', status: 'Served' },
        { qty: 1, item: 'Iced Tea', price: '₹150', status: 'Served' },
      ],
      status: 'Served' 
    },
  ];

  return NextResponse.json(bills);
}
