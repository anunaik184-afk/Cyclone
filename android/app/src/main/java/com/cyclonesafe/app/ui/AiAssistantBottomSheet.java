package com.cyclonesafe.app.ui;

import android.os.Bundle;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.cyclonesafe.app.R;
import com.cyclonesafe.app.data.AiAssistantRepository;
import com.google.android.material.bottomsheet.BottomSheetDialogFragment;
import java.util.ArrayList;
import java.util.List;

public class AiAssistantBottomSheet extends BottomSheetDialogFragment {
    private static final String ARG_LAT = "arg_lat";
    private static final String ARG_LNG = "arg_lng";

    private double userLat = Double.NaN;
    private double userLng = Double.NaN;

    private final List<AiAssistantRepository.ChatTurn> messages = new ArrayList<>();
    private ChatAdapter adapter;
    private AiAssistantRepository repository;

    private RecyclerView rvChatMessages;
    private TextView tvStatus;
    private EditText etInput;
    private Button btnSend;
    private boolean isSending = false;

    public static AiAssistantBottomSheet newInstance(double lat, double lng) {
        AiAssistantBottomSheet sheet = new AiAssistantBottomSheet();
        Bundle args = new Bundle();
        args.putDouble(ARG_LAT, lat);
        args.putDouble(ARG_LNG, lng);
        sheet.setArguments(args);
        return sheet;
    }

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getArguments() != null) {
            userLat = getArguments().getDouble(ARG_LAT, Double.NaN);
            userLng = getArguments().getDouble(ARG_LNG, Double.NaN);
        }
        repository = new AiAssistantRepository();
        messages.add(new AiAssistantRepository.ChatTurn(
                "model",
                "Hello, I am CycloneSafe AI Assistant. Ask me about cyclone preparedness, flood safety, 72-hour emergency kits, or Indian disaster helplines (112 / 108 / 1078)."
        ));
    }

    @Nullable
    @Override
    public View onCreateView(
            @NonNull LayoutInflater inflater,
            @Nullable ViewGroup container,
            @Nullable Bundle savedInstanceState
    ) {
        return inflater.inflate(R.layout.bottom_sheet_ai_assistant, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        rvChatMessages = view.findViewById(R.id.rvChatMessages);
        tvStatus = view.findViewById(R.id.tvAssistantStatus);
        etInput = view.findViewById(R.id.etChatInput);
        btnSend = view.findViewById(R.id.btnSendMessage);

        adapter = new ChatAdapter(messages);
        rvChatMessages.setLayoutManager(new LinearLayoutManager(requireContext()));
        rvChatMessages.setAdapter(adapter);

        view.findViewById(R.id.btnCloseAssistant).setOnClickListener(v -> dismiss());

        view.findViewById(R.id.chipCyclone).setOnClickListener(v ->
                sendUserMessage("What should I do to prepare for a cyclone evacuation in India?"));
        view.findViewById(R.id.chipFlood).setOnClickListener(v ->
                sendUserMessage("What are essential flood safety steps if water enters my area?"));
        view.findViewById(R.id.chipFirstAid).setOnClickListener(v ->
                sendUserMessage("List essential items for a 72-hour cyclone emergency go-bag."));
        view.findViewById(R.id.chipHelplines).setOnClickListener(v ->
                sendUserMessage("List key Indian disaster and medical emergency helpline numbers."));

        btnSend.setOnClickListener(v -> sendUserMessage(etInput.getText().toString()));
    }

    private void sendUserMessage(String rawText) {
        String text = rawText == null ? "" : rawText.trim();
        if (text.isEmpty() || isSending) return;

        List<AiAssistantRepository.ChatTurn> historySnapshot = new ArrayList<>();
        for (int i = 1; i < messages.size(); i++) {
            historySnapshot.add(messages.get(i));
        }

        messages.add(new AiAssistantRepository.ChatTurn("user", text));
        adapter.notifyItemInserted(messages.size() - 1);
        rvChatMessages.scrollToPosition(messages.size() - 1);
        etInput.setText("");

        isSending = true;
        btnSend.setEnabled(false);
        tvStatus.setText("Thinking...");
        tvStatus.setTextColor(ContextCompat.getColor(requireContext(), R.color.brand_slate_muted));
        tvStatus.setVisibility(View.VISIBLE);

        repository.sendMessage(text, historySnapshot, userLat, userLng, new AiAssistantRepository.AssistantCallback() {
            @Override
            public void onSuccess(String reply) {
                if (!isAdded()) return;
                isSending = false;
                btnSend.setEnabled(true);
                tvStatus.setVisibility(View.GONE);
                messages.add(new AiAssistantRepository.ChatTurn("model", reply));
                adapter.notifyItemInserted(messages.size() - 1);
                rvChatMessages.scrollToPosition(messages.size() - 1);
            }

            @Override
            public void onError(String errorMessage) {
                if (!isAdded()) return;
                isSending = false;
                btnSend.setEnabled(true);
                tvStatus.setText(errorMessage);
                tvStatus.setTextColor(ContextCompat.getColor(requireContext(), R.color.emergency_red));
                tvStatus.setVisibility(View.VISIBLE);
            }
        });
    }

    private static class ChatAdapter extends RecyclerView.Adapter<ChatAdapter.ViewHolder> {
        private final List<AiAssistantRepository.ChatTurn> items;

        ChatAdapter(List<AiAssistantRepository.ChatTurn> items) {
            this.items = items;
        }

        @NonNull
        @Override
        public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            View v = LayoutInflater.from(parent.getContext())
                    .inflate(R.layout.item_chat_message, parent, false);
            return new ViewHolder(v);
        }

        @Override
        public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
            AiAssistantRepository.ChatTurn item = items.get(position);
            boolean isUser = "user".equals(item.role);
            holder.container.setGravity(isUser ? Gravity.END : Gravity.START);
            holder.tvMessage.setText(item.text);
            holder.tvMessage.setBackgroundResource(
                    isUser ? R.drawable.bg_chat_bubble_user : R.drawable.bg_chat_bubble_ai
            );
            holder.tvMessage.setTextColor(ContextCompat.getColor(
                    holder.itemView.getContext(),
                    isUser ? R.color.white : R.color.brand_slate
            ));
        }

        @Override
        public int getItemCount() {
            return items.size();
        }

        static class ViewHolder extends RecyclerView.ViewHolder {
            final LinearLayout container;
            final TextView tvMessage;

            ViewHolder(@NonNull View itemView) {
                super(itemView);
                container = itemView.findViewById(R.id.bubbleContainer);
                tvMessage = itemView.findViewById(R.id.tvMessage);
            }
        }
    }
}
