import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';

interface TimePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onTimeSelect: (time: string) => void;
  title: string;
  initialTime?: string;
}

export const TimePicker: React.FC<TimePickerProps> = ({
  isOpen,
  onClose,
  onTimeSelect,
  title,
  initialTime = "08:00"
}) => {
  const [selectedHour, setSelectedHour] = useState(() => {
    if (initialTime) {
      return initialTime.split(':')[0];
    }
    return "08";
  });

  const [selectedMinute, setSelectedMinute] = useState(() => {
    if (initialTime) {
      return initialTime.split(':')[1];
    }
    return "00";
  });

  const hours = Array.from({ length: 24 }, (_, i) =>
    i.toString().padStart(2, '0')
  );

  const minutes = Array.from({ length: 12 }, (_, i) =>
    (i * 5).toString().padStart(2, '0')
  );

  const handleConfirm = () => {
    const time = `${selectedHour}:${selectedMinute}`;
    onTimeSelect(time);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="py-6">
          <div className="flex items-center justify-center gap-4">
            {/* Hour Selector */}
            <div className="flex flex-col items-center">
              <label className="text-sm font-medium text-gray-700 mb-2">
                Hora
              </label>
              <div className="bg-gray-50 rounded-lg p-2 max-h-48 overflow-y-auto">
                <div className="space-y-1">
                  {hours.map((hour) => (
                    <button
                      key={hour}
                      onClick={() => setSelectedHour(hour)}
                      className={`w-12 h-10 rounded-md text-sm font-medium transition-colors ${
                        selectedHour === hour
                          ? 'bg-orange-500 text-white'
                          : 'hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      {hour}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Separator */}
            <div className="text-2xl font-bold text-gray-400 mt-8">:</div>

            {/* Minute Selector */}
            <div className="flex flex-col items-center">
              <label className="text-sm font-medium text-gray-700 mb-2">
                Minuto
              </label>
              <div className="bg-gray-50 rounded-lg p-2 max-h-48 overflow-y-auto">
                <div className="space-y-1">
                  {minutes.map((minute) => (
                    <button
                      key={minute}
                      onClick={() => setSelectedMinute(minute)}
                      className={`w-12 h-10 rounded-md text-sm font-medium transition-colors ${
                        selectedMinute === minute
                          ? 'bg-orange-500 text-white'
                          : 'hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      {minute}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Selected Time Display */}
          <div className="mt-6 text-center">
            <div className="text-sm text-gray-600 mb-2">Horário selecionado:</div>
            <div className="text-3xl font-bold text-orange-500">
              {selectedHour}:{selectedMinute}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-orange-500 hover:bg-orange-600"
          >
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};