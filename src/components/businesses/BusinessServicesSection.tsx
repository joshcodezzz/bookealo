"use client";

import { useState } from "react";
import {
  BookingSheet,
  type BookableBusiness,
  type BookableService,
  type BookingDayOption,
} from "@/components/booking/BookingSheet";
import { BusinessSchedulePreview } from "@/components/businesses/BusinessSchedulePreview";
import { Button } from "@/components/ui/Button";
import { CalendarIcon } from "@/components/ui/Icons";
import { EmptyState } from "@/components/ui/States";
import { formatUSD } from "@/lib/currency";
import type { ScheduleRow, UserRole } from "@/types/database";

export type ServiceWithSchedules = BookableService & {
  schedules: ScheduleRow[];
};

type BusinessServicesSectionProps = {
  business: BookableBusiness;
  services: ServiceWithSchedules[];
  days: BookingDayOption[];
  userRole: UserRole | null;
  initialServiceId?: string | null;
  initialDateStr?: string | null;
  initialSlotTime?: string | null;
  /** Solo en canchas y espacios tiene sentido decir si es techado o al aire libre. */
  showRoof?: boolean;
  /** Turno libre más cercano, ya verificado en el servidor. */
  nextSlot?: NextSlotSuggestion | null;
};

export type NextSlotSuggestion = {
  serviceId: string;
  dateStr: string;
  /** HH:MM, como lo espera la hoja de reserva */
  startTime: string;
  /** «Hoy», «Mañana» o el día de la semana con su número */
  dayLabel: string;
  timeLabel: string;
};

export function BusinessServicesSection({
  business,
  services,
  days,
  userRole,
  initialServiceId,
  initialDateStr,
  initialSlotTime,
  showRoof = true,
  nextSlot = null,
}: BusinessServicesSectionProps) {
  const canReserve = userRole === null || userRole === "customer";
  const isNonCustomerRole =
    userRole === "business_owner" || userRole === "super_admin";

  const matchedInitialService =
    canReserve && initialServiceId
      ? (services.find((s) => s.id === initialServiceId) ?? null)
      : null;

  const [activeService, setActiveService] = useState<BookableService | null>(
    matchedInitialService,
  );
  const [sheetInitialDate, setSheetInitialDate] = useState<string | null>(
    matchedInitialService ? (initialDateStr ?? null) : null,
  );
  const [sheetInitialTime, setSheetInitialTime] = useState<string | null>(
    matchedInitialService ? (initialSlotTime ?? null) : null,
  );

  const handleOpenService = (service: BookableService) => {
    setSheetInitialDate(null);
    setSheetInitialTime(null);
    setActiveService(service);
  };

  // Al tocar un día del horario se abre la reserva en la próxima fecha de ese día.
  const bookableDays = [...new Set(days.map((d) => d.dayOfWeek))];
  const handlePickDay = (service: BookableService, dayOfWeek: number) => {
    const next = days.find((d) => d.dayOfWeek === dayOfWeek);
    setSheetInitialDate(next?.dateStr ?? null);
    setSheetInitialTime(null);
    setActiveService(service);
  };

  // La sugerencia solo se muestra a quien puede reservar y si el servicio sigue en la lista.
  const nextSlotService = canReserve && nextSlot ? (services.find((s) => s.id === nextSlot.serviceId) ?? null) : null;
  const handleReserveNextSlot = () => {
    if (!nextSlot || !nextSlotService) return;
    setSheetInitialDate(nextSlot.dateStr);
    setSheetInitialTime(nextSlot.startTime);
    setActiveService(nextSlotService);
  };

  return (
    <section aria-label="Servicios disponibles">
      {isNonCustomerRole && (
        <div className="mb-8 rounded-[16px] border border-[#ffa530]/25 bg-[rgba(255,159,10,0.1)] px-5 py-3.5 text-[14px] text-[#ffa530]">
          Necesitas una cuenta de cliente para reservar.
        </div>
      )}

      {nextSlot && nextSlotService && (
        <div
          aria-labelledby="bk-proximo-turno"
          role="group"
          className="mb-12 flex flex-wrap items-center justify-between gap-x-10 gap-y-6 rounded-[24px] border border-[#2997ff]/45 bg-[#111113] p-6 min-[900px]:mb-16 min-[900px]:p-8"
        >
          <div className="min-w-0">
            <p id="bk-proximo-turno" className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#5be08f]">
              Próximo turno disponible
            </p>
            <p className="mt-2.5 text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-[#f5f5f7] tabular-nums min-[900px]:text-[40px]">
              {nextSlot.dayLabel}, {nextSlot.timeLabel}
            </p>
            <p className="mt-2 text-[16px] text-[#f5f5f7]/80 min-[900px]:text-[17px]">
              {nextSlotService.name} · {nextSlotService.slot_duration_minutes} min ·{" "}
              <span className="font-semibold text-[#f5f5f7] tabular-nums">{formatUSD(nextSlotService.price)}</span>
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <Button size="lg" onClick={handleReserveNextSlot} className="w-full sm:w-auto">
              Reservar este turno
            </Button>
            <p className="text-center text-[13px] text-[#86868b] sm:text-right">
              O elige otro día u hora en los servicios de abajo.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-baseline justify-between gap-4 pb-6">
        <h2 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] text-[#f5f5f7] min-[900px]:text-[44px]">
          Servicios disponibles
        </h2>
        <span className="shrink-0 text-[14px] text-[#86868b] tabular-nums">
          {services.length} {services.length === 1 ? "servicio" : "servicios"}
        </span>
      </div>

      {services.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon className="h-5 w-5" />}
          title="No hay servicios activos en este momento"
          description="Este negocio aún no tiene servicios habilitados para reservar."
        />
      ) : (
        <div className="border-t border-white/10">
          {services.map((service) => (
            <article
              key={service.id}
              className="border-b border-white/10 py-8 min-[900px]:py-10"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5">
                <div>
                  <h3 className="text-[22px] font-semibold tracking-[-0.02em] text-[#f5f5f7] min-[900px]:text-[24px]">
                    {service.name}
                  </h3>
                  <p className="mt-1.5 text-[15px] text-[#86868b]">
                    {showRoof && <>{service.is_roofed ? "Techado" : "Aire libre"} · </>}
                    {service.slot_duration_minutes} min por turno
                  </p>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-[22px] font-semibold tracking-[-0.02em] text-[#f5f5f7] tabular-nums min-[900px]:text-[24px]">
                      {formatUSD(service.price)}
                    </div>
                    <div className="text-[13px] text-[#86868b] min-[900px]:text-[14px]">
                      por turno ({service.slot_duration_minutes} min)
                    </div>
                  </div>

                  {canReserve && (
                    <Button
                      size="md"
                      onClick={() => handleOpenService(service)}
                    >
                      Reservar
                    </Button>
                  )}
                </div>
              </div>

              <BusinessSchedulePreview
                schedules={service.schedules}
                onPickDay={canReserve ? (day) => handlePickDay(service, day) : undefined}
                bookableDays={bookableDays}
              />
            </article>
          ))}
        </div>
      )}

      {canReserve && activeService && (
        <BookingSheet
          key={`${activeService.id}-${sheetInitialDate ?? ""}-${sheetInitialTime ?? ""}`}
          onClose={() => setActiveService(null)}
          business={business}
          service={activeService}
          days={days}
          isAuthenticated={userRole === "customer"}
          initialDateStr={sheetInitialDate}
          initialSlotTime={sheetInitialTime}
        />
      )}
    </section>
  );
}
